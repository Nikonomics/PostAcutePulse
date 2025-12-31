#!/usr/bin/env python3
"""
CMS Quality Measures FAST Ingestion Script

Ingests 60 months of CMS NH Quality Measure data (MDS + Claims) into PostgreSQL.
Target: snf_market_data (Render Postgres marketplace database)

OPTIMIZATIONS:
- COPY INTO staging (10-50x faster than execute_values)
- Skip already-loaded months (checks gold.nh_quality_extracts)
- UNLOGGED staging tables (no WAL overhead)
- Parallel processing (default: 2 workers by month)
- DELETE + INSERT pattern (faster than UPSERT for bulk)

WORKER SAFETY:
- Each worker uses a separate thread-local database connection
- Each worker processes a unique extract_id (no concurrent access)
- Month queue is pre-partitioned; no runtime contention
- Staging data is scoped by extract_id; workers don't interfere

EXPECTED RUNTIME:
- 60 months with 2 workers: ~2 hours
- 60 months with 4 workers: ~1.2 hours

RECOMMENDED FULL INGESTION:
    python ingest_fast.py \\
        --data-dir /Users/nikolashulewsky/Desktop/cms_historical_data \\
        --workers 2

OTHER USAGE:
    # Setup schema only
    python ingest_fast.py --setup-schema

    # Force reload all months
    python ingest_fast.py --data-dir /path/to/data --workers 2 --force

    # Test with limited months
    python ingest_fast.py --data-dir /path/to/data --limit 3

    # Run post-ingestion validation
    python ingest_fast.py --validate

SUCCESS CRITERIA:
    - 60 extracts in gold.nh_quality_extracts
    - ~17.5M MDS rows, ~3.6M Claims rows in gold tables
    - 0 duplicate records
    - All CRID measures (410, 453, 407, 409, 551, 552) present
"""

import os
import re
import sys
import argparse
import csv
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Set
from io import StringIO
import logging
import concurrent.futures
import threading

import pandas as pd
import psycopg2
from psycopg2 import sql

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(threadName)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Thread-local storage for database connections
thread_local = threading.local()

# ============================================================================
# CONFIGURATION
# ============================================================================

DEFAULT_DB_URL = "postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data"

MONTH_MAP = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
}

SUPPRESSION_CODES = {'9', '10', '11', '12', '13', '14', '15'}

# Staging table columns for COPY
MDS_STAGING_COLUMNS = [
    'extract_id', 'as_of_date', 'source_file', 'ccn', 'provider_name',
    'provider_address', 'city', 'state', 'zip_code', 'measure_code',
    'measure_description', 'resident_type', 'q1_score', 'q1_footnote',
    'q2_score', 'q2_footnote', 'q3_score', 'q3_footnote', 'q4_score',
    'q4_footnote', 'four_quarter_avg', 'four_quarter_footnote',
    'used_in_star_rating', 'measure_period', 'location', 'processing_date'
]

CLAIMS_STAGING_COLUMNS = [
    'extract_id', 'as_of_date', 'source_file', 'ccn', 'provider_name',
    'provider_address', 'city', 'state', 'zip_code', 'measure_code',
    'measure_description', 'resident_type', 'adjusted_score',
    'observed_score', 'expected_score', 'footnote', 'used_in_star_rating',
    'measure_period', 'location', 'processing_date'
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_filename_date(filename: str) -> Tuple[str, datetime]:
    """Parse MonYYYY from filename to extract_id (YYYYMM) and as_of_date."""
    pattern = r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})'
    match = re.search(pattern, filename)
    if not match:
        raise ValueError(f"Could not parse date from filename: {filename}")
    month_name, year = match.groups()
    month_num = MONTH_MAP[month_name]
    extract_id = f"{year}{month_num}"
    as_of_date = datetime(int(year), int(month_num), 1)
    return extract_id, as_of_date


def standardize_ccn(ccn_value) -> Optional[str]:
    """Standardize CCN to 6-character string format."""
    if pd.isna(ccn_value) or ccn_value is None:
        return None
    ccn_str = str(ccn_value).strip()
    ccn_str = re.sub(r'[^A-Za-z0-9]', '', ccn_str)
    if len(ccn_str) < 6:
        ccn_str = ccn_str.zfill(6)
    return ccn_str[:6] if ccn_str else None


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names for 2020 vs 2021+ naming differences."""
    column_map = {
        'Federal Provider Number': 'CMS Certification Number (CCN)',
        'CMS Certification Number': 'CMS Certification Number (CCN)',
        'Provider City': 'City/Town',
        'City': 'City/Town',
        'Provider State': 'State',
        'Provider Zip Code': 'ZIP Code',
        'Zip Code': 'ZIP Code',
    }
    for old_name, new_name in column_map.items():
        if old_name in df.columns and new_name not in df.columns:
            df = df.rename(columns={old_name: new_name})
    return df


def read_csv_with_encoding(filepath, **kwargs) -> pd.DataFrame:
    """Read CSV with automatic encoding detection."""
    try:
        return pd.read_csv(filepath, encoding='utf-8', **kwargs)
    except UnicodeDecodeError:
        return pd.read_csv(filepath, encoding='latin-1', **kwargs)


def escape_csv_value(val) -> str:
    """Escape a value for CSV format (for COPY)."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return r'\N'  # PostgreSQL NULL in COPY format
    s = str(val)
    # Escape backslashes, tabs, newlines
    s = s.replace('\\', '\\\\').replace('\t', '\\t').replace('\n', '\\n').replace('\r', '\\r')
    return s


# ============================================================================
# FILE DISCOVERY
# ============================================================================

def discover_quality_files(data_dir: str) -> Tuple[List[Tuple[Path, str, str]], List[Tuple[Path, str, str]]]:
    """
    Discover all MDS and Claims CSV files.
    Returns (mds_files, claims_files) where each is list of (path, filename, extract_id) tuples.
    """
    data_path = Path(data_dir)
    mds_files = []
    claims_files = []

    for csv_path in data_path.rglob('NH_QualityMsr_MDS_*.csv'):
        try:
            extract_id, _ = parse_filename_date(csv_path.name)
            mds_files.append((csv_path, csv_path.name, extract_id))
        except ValueError:
            logger.warning(f"Skipping file with unparseable date: {csv_path.name}")

    for csv_path in data_path.rglob('NH_QualityMsr_Claims_*.csv'):
        try:
            extract_id, _ = parse_filename_date(csv_path.name)
            claims_files.append((csv_path, csv_path.name, extract_id))
        except ValueError:
            logger.warning(f"Skipping file with unparseable date: {csv_path.name}")

    mds_files.sort(key=lambda x: x[2])
    claims_files.sort(key=lambda x: x[2])

    return mds_files, claims_files


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def get_connection(db_url: str):
    """Get or create thread-local database connection."""
    if not hasattr(thread_local, 'conn') or thread_local.conn.closed:
        thread_local.conn = psycopg2.connect(db_url)
    return thread_local.conn


def get_loaded_extracts(conn) -> Set[str]:
    """Get set of already-loaded extract_ids from gold.nh_quality_extracts."""
    with conn.cursor() as cur:
        cur.execute("SELECT extract_id FROM gold.nh_quality_extracts")
        return {row[0] for row in cur.fetchall()}


def delete_extract_from_staging(conn, extract_id: str):
    """Delete existing data for an extract_id from staging tables."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM staging.nh_quality_mds_raw WHERE extract_id = %s", (extract_id,))
        cur.execute("DELETE FROM staging.nh_quality_claims_raw WHERE extract_id = %s", (extract_id,))
    conn.commit()


def delete_extract_from_gold(conn, extract_id: str):
    """Delete existing data for an extract_id from gold tables."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM gold.nh_quality_mds WHERE extract_id = %s", (extract_id,))
        cur.execute("DELETE FROM gold.nh_quality_claims WHERE extract_id = %s", (extract_id,))
        cur.execute("DELETE FROM gold.nh_quality_extracts WHERE extract_id = %s", (extract_id,))
    conn.commit()


def copy_mds_to_staging(conn, df: pd.DataFrame) -> int:
    """
    Use COPY to load MDS data into staging table (10-50x faster than INSERT).
    Uses pandas to_csv() instead of iterrows() for better performance.
    Returns row count.
    """
    if df.empty:
        return 0

    # Select columns in order and convert to CSV format for COPY
    # Use CSV format with proper escaping for PostgreSQL COPY
    buffer = StringIO()
    df_copy = df[MDS_STAGING_COLUMNS].copy()
    # Replace NaN/None with empty string for CSV, COPY will treat as NULL
    df_copy.to_csv(
        buffer, index=False, header=False, sep='\t',
        na_rep='', quoting=csv.QUOTE_NONE, escapechar='\\'
    )
    buffer.seek(0)

    with conn.cursor() as cur:
        cur.copy_expert(
            f"COPY staging.nh_quality_mds_raw ({','.join(MDS_STAGING_COLUMNS)}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '')",
            buffer
        )
    conn.commit()

    return len(df)


def copy_claims_to_staging(conn, df: pd.DataFrame) -> int:
    """
    Use COPY to load Claims data into staging table.
    Uses pandas to_csv() instead of iterrows() for better performance.
    Returns row count.
    """
    if df.empty:
        return 0

    buffer = StringIO()
    df_copy = df[CLAIMS_STAGING_COLUMNS].copy()
    df_copy.to_csv(
        buffer, index=False, header=False, sep='\t',
        na_rep='', quoting=csv.QUOTE_NONE, escapechar='\\'
    )
    buffer.seek(0)

    with conn.cursor() as cur:
        cur.copy_expert(
            f"COPY staging.nh_quality_claims_raw ({','.join(CLAIMS_STAGING_COLUMNS)}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '')",
            buffer
        )
    conn.commit()

    return len(df)


def transform_extract_to_gold(conn, extract_id: str) -> Tuple[int, int]:
    """
    Transform a single extract_id from staging to gold.
    Uses DELETE + INSERT (faster than UPSERT for bulk).
    """
    with conn.cursor() as cur:
        # Delete existing gold data for this extract
        cur.execute("DELETE FROM gold.nh_quality_mds WHERE extract_id = %s", (extract_id,))
        cur.execute("DELETE FROM gold.nh_quality_claims WHERE extract_id = %s", (extract_id,))

        # Insert MDS (note: %% escapes % for psycopg2 in LIKE patterns)
        cur.execute("""
            INSERT INTO gold.nh_quality_mds (
                ccn, extract_id, as_of_date, measure_code, measure_description,
                resident_type, q1_score, q2_score, q3_score, q4_score,
                four_quarter_avg, footnotes, has_suppression, used_in_star_rating,
                measure_period, processing_date, state
            )
            SELECT
                ccn, extract_id, as_of_date, measure_code, measure_description,
                CASE
                    WHEN LOWER(resident_type) LIKE '%%long%%' THEN 'long_stay'
                    WHEN LOWER(resident_type) LIKE '%%short%%' THEN 'short_stay'
                    ELSE LOWER(REPLACE(COALESCE(resident_type, ''), ' ', '_'))
                END,
                q1_score, q2_score, q3_score, q4_score, four_quarter_avg,
                jsonb_build_object(
                    'q1', q1_footnote, 'q2', q2_footnote,
                    'q3', q3_footnote, 'q4', q4_footnote,
                    'avg', four_quarter_footnote
                ),
                (
                    COALESCE(q1_footnote, '') IN ('9','10','11','12','13','14','15') OR
                    COALESCE(q2_footnote, '') IN ('9','10','11','12','13','14','15') OR
                    COALESCE(q3_footnote, '') IN ('9','10','11','12','13','14','15') OR
                    COALESCE(q4_footnote, '') IN ('9','10','11','12','13','14','15') OR
                    COALESCE(four_quarter_footnote, '') IN ('9','10','11','12','13','14','15')
                ),
                used_in_star_rating = 'Y',
                measure_period,
                processing_date,
                LEFT(ccn, 2)
            FROM staging.nh_quality_mds_raw
            WHERE extract_id = %s
        """, (extract_id,))
        mds_count = cur.rowcount

        # Insert Claims (note: %% escapes % for psycopg2 in LIKE patterns)
        cur.execute("""
            INSERT INTO gold.nh_quality_claims (
                ccn, extract_id, as_of_date, measure_code, measure_description,
                resident_type, adjusted_score, observed_score, expected_score,
                footnote, has_suppression, used_in_star_rating, measure_period,
                processing_date, state
            )
            SELECT
                ccn, extract_id, as_of_date, measure_code, measure_description,
                CASE
                    WHEN LOWER(resident_type) LIKE '%%long%%' THEN 'long_stay'
                    WHEN LOWER(resident_type) LIKE '%%short%%' THEN 'short_stay'
                    ELSE LOWER(REPLACE(COALESCE(resident_type, ''), ' ', '_'))
                END,
                adjusted_score, observed_score, expected_score,
                footnote,
                COALESCE(footnote, '') IN ('9','10','11','12','13','14','15'),
                used_in_star_rating = 'Y',
                measure_period,
                processing_date,
                LEFT(ccn, 2)
            FROM staging.nh_quality_claims_raw
            WHERE extract_id = %s
        """, (extract_id,))
        claims_count = cur.rowcount

        # Update extracts metadata
        cur.execute("""
            INSERT INTO gold.nh_quality_extracts (
                extract_id, as_of_date, mds_row_count, claims_row_count,
                mds_facility_count, claims_facility_count, mds_source_file, claims_source_file
            )
            SELECT
                COALESCE(m.extract_id, c.extract_id),
                COALESCE(m.as_of_date, c.as_of_date),
                m.mds_count, c.claims_count,
                m.mds_facilities, c.claims_facilities,
                m.source_file, c.source_file
            FROM (
                SELECT extract_id, MIN(as_of_date) as as_of_date,
                       COUNT(*) as mds_count, COUNT(DISTINCT ccn) as mds_facilities,
                       MIN(source_file) as source_file
                FROM staging.nh_quality_mds_raw WHERE extract_id = %s GROUP BY extract_id
            ) m
            FULL OUTER JOIN (
                SELECT extract_id, MIN(as_of_date) as as_of_date,
                       COUNT(*) as claims_count, COUNT(DISTINCT ccn) as claims_facilities,
                       MIN(source_file) as source_file
                FROM staging.nh_quality_claims_raw WHERE extract_id = %s GROUP BY extract_id
            ) c ON m.extract_id = c.extract_id
            ON CONFLICT (extract_id) DO UPDATE SET
                mds_row_count = EXCLUDED.mds_row_count,
                claims_row_count = EXCLUDED.claims_row_count,
                mds_facility_count = EXCLUDED.mds_facility_count,
                claims_facility_count = EXCLUDED.claims_facility_count,
                updated_at = NOW()
        """, (extract_id, extract_id))

        conn.commit()

    return mds_count, claims_count


# ============================================================================
# DATA LOADING
# ============================================================================

def load_mds_dataframe(filepath: Path, filename: str) -> pd.DataFrame:
    """Load and clean an MDS quality measures CSV file."""
    extract_id, as_of_date = parse_filename_date(filename)

    df = read_csv_with_encoding(filepath, dtype=str, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = normalize_column_names(df)

    result = pd.DataFrame({
        'extract_id': extract_id,
        'as_of_date': as_of_date.strftime('%Y-%m-%d'),
        'source_file': filename,
        'ccn': df['CMS Certification Number (CCN)'].apply(standardize_ccn),
        'provider_name': df['Provider Name'],
        'provider_address': df['Provider Address'],
        'city': df.get('City/Town', df.get('City', '')),
        'state': df['State'],
        'zip_code': df.get('ZIP Code', df.get('Zip Code', '')),
        'measure_code': df['Measure Code'].astype(str).str.strip(),
        'measure_description': df['Measure Description'],
        'resident_type': df['Resident type'],
        'q1_score': pd.to_numeric(df['Q1 Measure Score'], errors='coerce'),
        'q1_footnote': df['Footnote for Q1 Measure Score'],
        'q2_score': pd.to_numeric(df['Q2 Measure Score'], errors='coerce'),
        'q2_footnote': df['Footnote for Q2 Measure Score'],
        'q3_score': pd.to_numeric(df['Q3 Measure Score'], errors='coerce'),
        'q3_footnote': df['Footnote for Q3 Measure Score'],
        'q4_score': pd.to_numeric(df['Q4 Measure Score'], errors='coerce'),
        'q4_footnote': df['Footnote for Q4 Measure Score'],
        'four_quarter_avg': pd.to_numeric(df['Four Quarter Average Score'], errors='coerce'),
        'four_quarter_footnote': df['Footnote for Four Quarter Average Score'],
        'used_in_star_rating': df['Used in Quality Measure Five Star Rating'],
        'measure_period': df['Measure Period'],
        'location': df['Location'],
        'processing_date': pd.to_datetime(df['Processing Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    })

    result = result[result['ccn'].notna() & result['measure_code'].notna()]
    return result


def load_claims_dataframe(filepath: Path, filename: str) -> pd.DataFrame:
    """Load and clean a Claims quality measures CSV file."""
    extract_id, as_of_date = parse_filename_date(filename)

    df = read_csv_with_encoding(filepath, dtype=str, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = normalize_column_names(df)

    result = pd.DataFrame({
        'extract_id': extract_id,
        'as_of_date': as_of_date.strftime('%Y-%m-%d'),
        'source_file': filename,
        'ccn': df['CMS Certification Number (CCN)'].apply(standardize_ccn),
        'provider_name': df['Provider Name'],
        'provider_address': df['Provider Address'],
        'city': df.get('City/Town', df.get('City', '')),
        'state': df['State'],
        'zip_code': df.get('ZIP Code', df.get('Zip Code', '')),
        'measure_code': df['Measure Code'].astype(str).str.strip(),
        'measure_description': df['Measure Description'],
        'resident_type': df['Resident type'],
        'adjusted_score': pd.to_numeric(df['Adjusted Score'], errors='coerce'),
        'observed_score': pd.to_numeric(df['Observed Score'], errors='coerce'),
        'expected_score': pd.to_numeric(df['Expected Score'], errors='coerce'),
        'footnote': df['Footnote for Score'],
        'used_in_star_rating': df['Used in Quality Measure Five Star Rating'],
        'measure_period': df['Measure Period'],
        'location': df['Location'],
        'processing_date': pd.to_datetime(df['Processing Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    })

    result = result[result['ccn'].notna() & result['measure_code'].notna()]
    return result


# ============================================================================
# WORKER FUNCTION FOR PARALLEL PROCESSING
# ============================================================================

def process_month(
    db_url: str,
    extract_id: str,
    mds_file: Optional[Tuple[Path, str]],
    claims_file: Optional[Tuple[Path, str]],
    force: bool = False
) -> Dict:
    """
    Process a single month's data. Safe for parallel execution.
    Each worker uses its own connection and processes its own extract_id.
    """
    result = {
        'extract_id': extract_id,
        'mds_rows': 0,
        'claims_rows': 0,
        'gold_mds': 0,
        'gold_claims': 0,
        'skipped': False,
        'error': None
    }

    try:
        conn = get_connection(db_url)

        # Check if already loaded (skip if not forcing)
        if not force:
            loaded = get_loaded_extracts(conn)
            if extract_id in loaded:
                logger.info(f"[{extract_id}] Already loaded, skipping")
                result['skipped'] = True
                return result

        logger.info(f"[{extract_id}] Processing...")

        # Clear staging for this extract
        delete_extract_from_staging(conn, extract_id)

        # If forcing, also clear gold
        if force:
            delete_extract_from_gold(conn, extract_id)

        # Load MDS
        if mds_file:
            filepath, filename = mds_file
            df = load_mds_dataframe(filepath, filename)
            result['mds_rows'] = copy_mds_to_staging(conn, df)
            logger.info(f"[{extract_id}] MDS: {result['mds_rows']:,} rows")

        # Load Claims
        if claims_file:
            filepath, filename = claims_file
            df = load_claims_dataframe(filepath, filename)
            result['claims_rows'] = copy_claims_to_staging(conn, df)
            logger.info(f"[{extract_id}] Claims: {result['claims_rows']:,} rows")

        # Transform to gold
        result['gold_mds'], result['gold_claims'] = transform_extract_to_gold(conn, extract_id)
        logger.info(f"[{extract_id}] Gold: {result['gold_mds']:,} MDS, {result['gold_claims']:,} Claims")

        # Clean up staging for this extract (optional, saves space)
        delete_extract_from_staging(conn, extract_id)

    except Exception as e:
        import traceback
        logger.error(f"[{extract_id}] Error: {e}\n{traceback.format_exc()}")
        result['error'] = str(e)

    return result


# ============================================================================
# SCHEMA MANAGEMENT
# ============================================================================

def run_schema_setup(conn):
    """Run schema setup SQL."""
    schema_path = Path(__file__).parent / 'schema.sql'
    if not schema_path.exists():
        logger.error(f"Schema file not found: {schema_path}")
        return False

    logger.info("Running schema setup...")
    with open(schema_path, 'r') as f:
        schema_sql = f.read()

    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()

    logger.info("Schema setup complete")
    return True


def make_staging_unlogged(conn):
    """Convert staging tables to UNLOGGED for faster writes."""
    logger.info("Converting staging tables to UNLOGGED...")
    with conn.cursor() as cur:
        # Check if already unlogged
        cur.execute("""
            SELECT relname, relpersistence
            FROM pg_class
            WHERE relname IN ('nh_quality_mds_raw', 'nh_quality_claims_raw')
              AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'staging')
        """)
        tables = {row[0]: row[1] for row in cur.fetchall()}

        for table, persistence in tables.items():
            if persistence != 'u':  # 'u' = unlogged
                logger.info(f"  Converting staging.{table} to UNLOGGED")
                cur.execute(f"ALTER TABLE staging.{table} SET UNLOGGED")

    conn.commit()
    logger.info("Staging tables are now UNLOGGED")


def drop_staging_indexes(conn):
    """Drop staging indexes before bulk load."""
    logger.info("Dropping staging indexes...")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'staging' AND indexname NOT LIKE '%_pkey'
        """)
        indexes = [row[0] for row in cur.fetchall()]

        for idx in indexes:
            logger.info(f"  Dropping index: {idx}")
            cur.execute(f"DROP INDEX IF EXISTS staging.{idx}")

    conn.commit()


def recreate_staging_indexes(conn):
    """Recreate staging indexes after bulk load."""
    logger.info("Recreating staging indexes...")
    with conn.cursor() as cur:
        # MDS indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_mds_ccn ON staging.nh_quality_mds_raw(ccn)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_mds_extract ON staging.nh_quality_mds_raw(extract_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_mds_measure ON staging.nh_quality_mds_raw(measure_code)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_mds_state ON staging.nh_quality_mds_raw(state)")

        # Claims indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_claims_ccn ON staging.nh_quality_claims_raw(ccn)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_claims_extract ON staging.nh_quality_claims_raw(extract_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_claims_measure ON staging.nh_quality_claims_raw(measure_code)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stg_claims_state ON staging.nh_quality_claims_raw(state)")

    conn.commit()
    logger.info("Staging indexes recreated")


# ============================================================================
# POST-INGESTION VALIDATION
# ============================================================================

def run_validation(conn) -> bool:
    """
    Run post-ingestion validation and print summary.
    Returns True if validation passes, False otherwise.
    """
    print("\n" + "=" * 70)
    print("POST-INGESTION VALIDATION")
    print("=" * 70)

    errors = []

    with conn.cursor() as cur:
        # 1. Count extracts
        cur.execute("SELECT COUNT(*) FROM gold.nh_quality_extracts")
        extract_count = cur.fetchone()[0]
        print(f"\n[1] EXTRACTS LOADED: {extract_count}")
        if extract_count == 0:
            errors.append("No extracts loaded!")
        elif extract_count < 60:
            print(f"    WARNING: Expected ~60 extracts, found {extract_count}")

        # 2. Total row counts
        cur.execute("SELECT COUNT(*) FROM gold.nh_quality_mds")
        mds_total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM gold.nh_quality_claims")
        claims_total = cur.fetchone()[0]
        print(f"\n[2] TOTAL ROWS:")
        print(f"    MDS:    {mds_total:>12,}")
        print(f"    Claims: {claims_total:>12,}")

        # 3. Row counts by extract_id
        print(f"\n[3] ROWS BY EXTRACT (first 10 and last 5):")
        cur.execute("""
            SELECT
                e.extract_id,
                e.as_of_date,
                COALESCE(e.mds_row_count, 0) as mds_rows,
                COALESCE(e.claims_row_count, 0) as claims_rows
            FROM gold.nh_quality_extracts e
            ORDER BY e.extract_id
        """)
        rows = cur.fetchall()
        if rows:
            # Show first 10
            for i, row in enumerate(rows[:10]):
                print(f"    {row[0]} ({row[1]}): MDS={row[2]:,}, Claims={row[3]:,}")
            if len(rows) > 15:
                print(f"    ... ({len(rows) - 15} more) ...")
            # Show last 5
            for row in rows[-5:]:
                print(f"    {row[0]} ({row[1]}): MDS={row[2]:,}, Claims={row[3]:,}")

        # 4. Check for duplicates
        print(f"\n[4] DUPLICATE CHECK:")
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT extract_id, ccn, measure_code, COUNT(*) as cnt
                FROM gold.nh_quality_mds
                GROUP BY extract_id, ccn, measure_code
                HAVING COUNT(*) > 1
            ) dups
        """)
        mds_dups = cur.fetchone()[0]
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT extract_id, ccn, measure_code, COUNT(*) as cnt
                FROM gold.nh_quality_claims
                GROUP BY extract_id, ccn, measure_code
                HAVING COUNT(*) > 1
            ) dups
        """)
        claims_dups = cur.fetchone()[0]
        if mds_dups == 0 and claims_dups == 0:
            print("    No duplicates found. OK")
        else:
            print(f"    WARNING: MDS duplicates={mds_dups}, Claims duplicates={claims_dups}")
            errors.append(f"Duplicates found: MDS={mds_dups}, Claims={claims_dups}")

        # 5. CRID measures availability (latest extract)
        print(f"\n[5] CRID MEASURES (latest extract):")
        cur.execute("""
            WITH latest AS (
                SELECT MAX(extract_id) as extract_id FROM gold.nh_quality_extracts
            )
            SELECT
                m.measure_code,
                COUNT(DISTINCT m.ccn) as facilities
            FROM gold.nh_quality_mds m
            JOIN latest l ON m.extract_id = l.extract_id
            WHERE m.measure_code IN ('410', '453', '407', '409')
            GROUP BY m.measure_code
            ORDER BY m.measure_code
        """)
        mds_measures = {row[0]: row[1] for row in cur.fetchall()}
        cur.execute("""
            WITH latest AS (
                SELECT MAX(extract_id) as extract_id FROM gold.nh_quality_extracts
            )
            SELECT
                c.measure_code,
                COUNT(DISTINCT c.ccn) as facilities
            FROM gold.nh_quality_claims c
            JOIN latest l ON c.extract_id = l.extract_id
            WHERE c.measure_code IN ('551', '552')
            GROUP BY c.measure_code
            ORDER BY c.measure_code
        """)
        claims_measures = {row[0]: row[1] for row in cur.fetchall()}

        crid_measures = {
            '410': 'Falls with major injury',
            '453': 'Pressure ulcers',
            '407': 'UTI prevalence',
            '409': 'Physical restraints',
            '551': 'Hospitalizations',
            '552': 'ED visits'
        }
        for code, desc in crid_measures.items():
            count = mds_measures.get(code) or claims_measures.get(code, 0)
            status = "OK" if count > 0 else "MISSING"
            print(f"    {code} ({desc}): {count:,} facilities [{status}]")
            if count == 0:
                errors.append(f"CRID measure {code} missing")

        # 6. Facilities with complete CRID data
        cur.execute("""
            WITH latest AS (
                SELECT MAX(extract_id) as extract_id FROM gold.nh_quality_extracts
            ),
            crid_mds AS (
                SELECT DISTINCT ccn
                FROM gold.nh_quality_mds m
                JOIN latest l ON m.extract_id = l.extract_id
                WHERE m.measure_code IN ('410', '453', '407', '409')
                  AND m.has_suppression = FALSE
                GROUP BY ccn
                HAVING COUNT(DISTINCT measure_code) = 4
            ),
            crid_claims AS (
                SELECT DISTINCT ccn
                FROM gold.nh_quality_claims c
                JOIN latest l ON c.extract_id = l.extract_id
                WHERE c.measure_code IN ('551', '552')
                  AND c.has_suppression = FALSE
                GROUP BY ccn
                HAVING COUNT(DISTINCT measure_code) = 2
            )
            SELECT COUNT(*) FROM crid_mds m JOIN crid_claims c ON m.ccn = c.ccn
        """)
        complete_crid = cur.fetchone()[0]
        print(f"\n[6] FACILITIES WITH COMPLETE CRID DATA: {complete_crid:,}")

    # Summary
    print("\n" + "=" * 70)
    if errors:
        print(f"VALIDATION FAILED - {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        print("=" * 70 + "\n")
        return False
    else:
        print("VALIDATION PASSED")
        print("=" * 70 + "\n")
        return True


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Fast CMS Quality Measures Ingestion',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full ingestion (recommended)
  python ingest_fast.py --data-dir /path/to/cms_historical_data --workers 2

  # Setup schema first
  python ingest_fast.py --setup-schema

  # Run validation after ingestion
  python ingest_fast.py --validate
        """
    )
    parser.add_argument('--data-dir', help='Path to cms_historical_data folder')
    parser.add_argument('--db-url', default=DEFAULT_DB_URL, help='PostgreSQL connection URL')
    parser.add_argument('--workers', type=int, default=2, help='Number of parallel workers (default: 2, max: 4)')
    parser.add_argument('--force', action='store_true', help='Force reload all months (ignore already-loaded)')
    parser.add_argument('--limit', type=int, help='Limit number of months to process (for testing)')
    parser.add_argument('--setup-schema', action='store_true', help='Run schema setup only')
    parser.add_argument('--validate', action='store_true', help='Run post-ingestion validation')
    parser.add_argument('--skip-unlogged', action='store_true', help='Skip UNLOGGED optimization')

    args = parser.parse_args()

    # Limit workers to 4 max (more may overwhelm the DB)
    args.workers = min(max(args.workers, 1), 4)

    logger.info(f"Connecting to marketplace database...")
    conn = psycopg2.connect(args.db_url)

    try:
        # Handle --setup-schema
        if args.setup_schema:
            if run_schema_setup(conn):
                logger.info("Schema setup complete.")
                return 0
            return 1

        # Handle --validate
        if args.validate:
            success = run_validation(conn)
            return 0 if success else 1

        if not args.data_dir:
            logger.error("--data-dir required for ingestion")
            return 1

        if not Path(args.data_dir).exists():
            logger.error(f"Data directory not found: {args.data_dir}")
            return 1

        # Discover files
        logger.info(f"Discovering files in: {args.data_dir}")
        mds_files, claims_files = discover_quality_files(args.data_dir)
        logger.info(f"Found {len(mds_files)} MDS files and {len(claims_files)} Claims files")

        # Build month map: extract_id -> (mds_file, claims_file)
        months = {}
        for filepath, filename, extract_id in mds_files:
            if extract_id not in months:
                months[extract_id] = {'mds': None, 'claims': None}
            months[extract_id]['mds'] = (filepath, filename)

        for filepath, filename, extract_id in claims_files:
            if extract_id not in months:
                months[extract_id] = {'mds': None, 'claims': None}
            months[extract_id]['claims'] = (filepath, filename)

        # Sort by extract_id
        extract_ids = sorted(months.keys())

        if args.limit:
            extract_ids = extract_ids[:args.limit]
            logger.info(f"Limited to {args.limit} months")

        # Optimize staging tables
        if not args.skip_unlogged:
            make_staging_unlogged(conn)

        # Check what's already loaded
        loaded = get_loaded_extracts(conn)
        to_process = [eid for eid in extract_ids if args.force or eid not in loaded]

        if not to_process:
            logger.info("All months already loaded. Use --force to reload.")
            return 0

        logger.info(f"Months to process: {len(to_process)} (skipping {len(extract_ids) - len(to_process)} already loaded)")

        # Close main connection before parallel processing
        conn.close()

        # Process months
        start_time = datetime.now()
        total_results = []

        if args.workers == 1:
            # Sequential processing
            for extract_id in to_process:
                result = process_month(
                    args.db_url,
                    extract_id,
                    months[extract_id]['mds'],
                    months[extract_id]['claims'],
                    args.force
                )
                total_results.append(result)
        else:
            # Parallel processing
            logger.info(f"Using {args.workers} parallel workers")
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = {
                    executor.submit(
                        process_month,
                        args.db_url,
                        extract_id,
                        months[extract_id]['mds'],
                        months[extract_id]['claims'],
                        args.force
                    ): extract_id
                    for extract_id in to_process
                }

                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    total_results.append(result)

        # Summary
        elapsed = (datetime.now() - start_time).total_seconds()
        total_mds = sum(r['gold_mds'] for r in total_results if not r['error'])
        total_claims = sum(r['gold_claims'] for r in total_results if not r['error'])
        errors = [r for r in total_results if r['error']]
        skipped = [r for r in total_results if r['skipped']]

        logger.info("=" * 60)
        logger.info("INGESTION COMPLETE")
        logger.info(f"  Months processed: {len(to_process) - len(skipped)}")
        logger.info(f"  Months skipped: {len(skipped)}")
        logger.info(f"  Total MDS rows: {total_mds:,}")
        logger.info(f"  Total Claims rows: {total_claims:,}")
        logger.info(f"  Elapsed time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
        if elapsed > 0:
            logger.info(f"  Rate: {(total_mds + total_claims) / elapsed:.0f} rows/sec")

        if errors:
            logger.warning(f"  Errors: {len(errors)}")
            for e in errors:
                logger.warning(f"    {e['extract_id']}: {e['error']}")
            return 1

        # Run validation after successful ingestion
        logger.info("\nRunning post-ingestion validation...")
        validation_conn = psycopg2.connect(args.db_url)
        try:
            validation_passed = run_validation(validation_conn)
        finally:
            validation_conn.close()

        if not validation_passed:
            logger.warning("Validation found issues - review output above")
            return 1

        logger.info("Ingestion and validation complete!")
        return 0

    finally:
        if not conn.closed:
            conn.close()


if __name__ == '__main__':
    sys.exit(main())
