#!/usr/bin/env python3
"""
CMS Quality Measures Ingestion Script for Marketplace Database

Ingests NH_QualityMsr_MDS_*.csv and NH_QualityMsr_Claims_*.csv files
into PostgreSQL marketplace database (snf_market_data).

Supports:
- Reading from extracted folders
- Reading from nested ZIP files (YEAR.zip → MONTH.zip → CSVs)
- Idempotent ingestion (safe to re-run)

Usage:
    # Setup schema only
    python ingest.py --setup-schema

    # Full ingestion from extracted folders
    python ingest.py --data-dir /path/to/cms_historical_data

    # Dry run (parse only)
    python ingest.py --data-dir /path/to/cms_historical_data --dry-run

    # Limit to N months (for testing)
    python ingest.py --data-dir /path/to/cms_historical_data --limit 3
"""

import os
import re
import sys
import argparse
import json
import uuid
import tempfile
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Generator
from contextlib import contextmanager
from io import StringIO
import logging

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Default marketplace database URL
DEFAULT_DB_URL = "postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data"

# Month name to number mapping
MONTH_MAP = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
}

# Suppression footnote codes
SUPPRESSION_CODES = {'9', '10', '11', '12', '13', '14', '15'}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_filename_date(filename: str) -> Tuple[str, datetime]:
    """
    Parse MonYYYY from filename to extract_id (YYYYMM) and as_of_date.

    Examples:
        NH_QualityMsr_MDS_Jan2024.csv -> ('202401', datetime(2024, 1, 1))
        NH_QualityMsr_Claims_Dec2023.csv -> ('202312', datetime(2023, 12, 1))
    """
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
    """
    Standardize CCN to 6-character string format.
    CMS CCNs are typically 6 characters but may be stored without leading zeros.
    """
    if pd.isna(ccn_value):
        return None

    ccn_str = str(ccn_value).strip()
    ccn_str = re.sub(r'[^A-Za-z0-9]', '', ccn_str)

    if len(ccn_str) < 6:
        ccn_str = ccn_str.zfill(6)

    return ccn_str[:6] if ccn_str else None


def get_state_from_ccn(ccn: str) -> Optional[str]:
    """Extract state code from CCN (first 2 characters)."""
    if ccn and len(ccn) >= 2:
        return ccn[:2]
    return None


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize column names to handle different CMS naming conventions.
    2020 files use 'Federal Provider Number', 'Provider City', etc.
    2021+ files use 'CMS Certification Number (CCN)', 'City/Town', etc.
    """
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


def read_csv_with_encoding(filepath_or_buffer, **kwargs) -> pd.DataFrame:
    """Read CSV with automatic encoding detection."""
    try:
        return pd.read_csv(filepath_or_buffer, encoding='utf-8', **kwargs)
    except UnicodeDecodeError:
        if hasattr(filepath_or_buffer, 'seek'):
            filepath_or_buffer.seek(0)
        return pd.read_csv(filepath_or_buffer, encoding='latin-1', **kwargs)


# ============================================================================
# FILE DISCOVERY
# ============================================================================

def find_csv_files_in_folder(data_dir: Path) -> Generator[Tuple[Path, str], None, None]:
    """
    Recursively find CSV files in extracted folders.
    Yields (filepath, filename) tuples.
    """
    for csv_path in data_dir.rglob('NH_QualityMsr_MDS_*.csv'):
        yield csv_path, csv_path.name

    for csv_path in data_dir.rglob('NH_QualityMsr_Claims_*.csv'):
        yield csv_path, csv_path.name


def find_csv_files_in_zips(data_dir: Path, temp_dir: Path) -> Generator[Tuple[Path, str], None, None]:
    """
    Find CSV files within nested ZIP structures.
    Extracts to temp directory as needed.
    Yields (filepath, filename) tuples.
    """
    # Find year-level ZIP files
    for year_zip in data_dir.glob('nursing_homes_*.zip'):
        logger.info(f"Processing year ZIP: {year_zip.name}")

        with zipfile.ZipFile(year_zip, 'r') as zf_year:
            # Look for month ZIPs inside
            for member in zf_year.namelist():
                if member.endswith('.zip') and 'nursing_homes' in member:
                    # Extract month ZIP to temp
                    month_zip_path = temp_dir / os.path.basename(member)
                    with zf_year.open(member) as src:
                        with open(month_zip_path, 'wb') as dst:
                            dst.write(src.read())

                    # Process month ZIP
                    try:
                        with zipfile.ZipFile(month_zip_path, 'r') as zf_month:
                            for csv_name in zf_month.namelist():
                                if 'NH_QualityMsr_MDS_' in csv_name or 'NH_QualityMsr_Claims_' in csv_name:
                                    # Extract CSV to temp
                                    csv_basename = os.path.basename(csv_name)
                                    csv_path = temp_dir / csv_basename
                                    with zf_month.open(csv_name) as src:
                                        with open(csv_path, 'wb') as dst:
                                            dst.write(src.read())
                                    yield csv_path, csv_basename
                    finally:
                        # Clean up month ZIP
                        if month_zip_path.exists():
                            month_zip_path.unlink()


def discover_quality_files(data_dir: str) -> Tuple[List[Tuple[Path, str]], List[Tuple[Path, str]]]:
    """
    Discover all MDS and Claims CSV files from both folders and ZIPs.
    Returns (mds_files, claims_files) where each is list of (path, filename) tuples.
    """
    data_path = Path(data_dir)

    mds_files = []
    claims_files = []

    # First, find files in extracted folders
    for filepath, filename in find_csv_files_in_folder(data_path):
        if 'NH_QualityMsr_MDS_' in filename:
            mds_files.append((filepath, filename))
        elif 'NH_QualityMsr_Claims_' in filename:
            claims_files.append((filepath, filename))

    # Sort by extract date
    def sort_key(item):
        try:
            extract_id, _ = parse_filename_date(item[1])
            return extract_id
        except ValueError:
            return '000000'

    mds_files.sort(key=sort_key)
    claims_files.sort(key=sort_key)

    return mds_files, claims_files


# ============================================================================
# DATA LOADING
# ============================================================================

def load_mds_dataframe(filepath: Path, filename: str) -> pd.DataFrame:
    """Load and clean an MDS quality measures CSV file."""
    logger.info(f"Loading MDS: {filename}")

    extract_id, as_of_date = parse_filename_date(filename)

    df = read_csv_with_encoding(filepath, dtype=str, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = normalize_column_names(df)

    # Build result DataFrame
    result = pd.DataFrame({
        'extract_id': extract_id,
        'as_of_date': as_of_date,
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
        'processing_date': pd.to_datetime(df['Processing Date'], errors='coerce')
    })

    result = result[result['ccn'].notna() & result['measure_code'].notna()]

    logger.info(f"  -> {len(result):,} rows")
    return result


def load_claims_dataframe(filepath: Path, filename: str) -> pd.DataFrame:
    """Load and clean a Claims quality measures CSV file."""
    logger.info(f"Loading Claims: {filename}")

    extract_id, as_of_date = parse_filename_date(filename)

    df = read_csv_with_encoding(filepath, dtype=str, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = normalize_column_names(df)

    result = pd.DataFrame({
        'extract_id': extract_id,
        'as_of_date': as_of_date,
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
        'processing_date': pd.to_datetime(df['Processing Date'], errors='coerce')
    })

    result = result[result['ccn'].notna() & result['measure_code'].notna()]

    logger.info(f"  -> {len(result):,} rows")
    return result


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def upsert_staging_mds(conn, df: pd.DataFrame) -> int:
    """Upsert MDS data into staging table. Returns row count."""
    if df.empty:
        return 0

    columns = [
        'extract_id', 'as_of_date', 'source_file', 'ccn', 'provider_name',
        'provider_address', 'city', 'state', 'zip_code', 'measure_code',
        'measure_description', 'resident_type', 'q1_score', 'q1_footnote',
        'q2_score', 'q2_footnote', 'q3_score', 'q3_footnote', 'q4_score',
        'q4_footnote', 'four_quarter_avg', 'four_quarter_footnote',
        'used_in_star_rating', 'measure_period', 'location', 'processing_date'
    ]

    records = []
    for _, row in df.iterrows():
        record = tuple(None if pd.isna(row[col]) else row[col] for col in columns)
        records.append(record)

    insert_sql = f"""
        INSERT INTO staging.nh_quality_mds_raw ({', '.join(columns)})
        VALUES %s
        ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
            as_of_date = EXCLUDED.as_of_date,
            source_file = EXCLUDED.source_file,
            provider_name = EXCLUDED.provider_name,
            provider_address = EXCLUDED.provider_address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip_code = EXCLUDED.zip_code,
            measure_description = EXCLUDED.measure_description,
            resident_type = EXCLUDED.resident_type,
            q1_score = EXCLUDED.q1_score,
            q1_footnote = EXCLUDED.q1_footnote,
            q2_score = EXCLUDED.q2_score,
            q2_footnote = EXCLUDED.q2_footnote,
            q3_score = EXCLUDED.q3_score,
            q3_footnote = EXCLUDED.q3_footnote,
            q4_score = EXCLUDED.q4_score,
            q4_footnote = EXCLUDED.q4_footnote,
            four_quarter_avg = EXCLUDED.four_quarter_avg,
            four_quarter_footnote = EXCLUDED.four_quarter_footnote,
            used_in_star_rating = EXCLUDED.used_in_star_rating,
            measure_period = EXCLUDED.measure_period,
            location = EXCLUDED.location,
            processing_date = EXCLUDED.processing_date
    """

    with conn.cursor() as cur:
        execute_values(cur, insert_sql, records, page_size=1000)
    conn.commit()

    return len(records)


def upsert_staging_claims(conn, df: pd.DataFrame) -> int:
    """Upsert Claims data into staging table. Returns row count."""
    if df.empty:
        return 0

    columns = [
        'extract_id', 'as_of_date', 'source_file', 'ccn', 'provider_name',
        'provider_address', 'city', 'state', 'zip_code', 'measure_code',
        'measure_description', 'resident_type', 'adjusted_score',
        'observed_score', 'expected_score', 'footnote', 'used_in_star_rating',
        'measure_period', 'location', 'processing_date'
    ]

    records = []
    for _, row in df.iterrows():
        record = tuple(None if pd.isna(row[col]) else row[col] for col in columns)
        records.append(record)

    insert_sql = f"""
        INSERT INTO staging.nh_quality_claims_raw ({', '.join(columns)})
        VALUES %s
        ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
            as_of_date = EXCLUDED.as_of_date,
            source_file = EXCLUDED.source_file,
            provider_name = EXCLUDED.provider_name,
            provider_address = EXCLUDED.provider_address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip_code = EXCLUDED.zip_code,
            measure_description = EXCLUDED.measure_description,
            resident_type = EXCLUDED.resident_type,
            adjusted_score = EXCLUDED.adjusted_score,
            observed_score = EXCLUDED.observed_score,
            expected_score = EXCLUDED.expected_score,
            footnote = EXCLUDED.footnote,
            used_in_star_rating = EXCLUDED.used_in_star_rating,
            measure_period = EXCLUDED.measure_period,
            location = EXCLUDED.location,
            processing_date = EXCLUDED.processing_date
    """

    with conn.cursor() as cur:
        execute_values(cur, insert_sql, records, page_size=1000)
    conn.commit()

    return len(records)


def transform_staging_to_gold(conn) -> Tuple[int, int]:
    """Transform staging data to gold tables. Returns (mds_count, claims_count)."""
    logger.info("Transforming staging -> gold...")

    with conn.cursor() as cur:
        # Transform MDS
        cur.execute("""
            INSERT INTO gold.nh_quality_mds (
                ccn, extract_id, as_of_date, measure_code, measure_description,
                resident_type, q1_score, q2_score, q3_score, q4_score,
                four_quarter_avg, footnotes, has_suppression, used_in_star_rating,
                measure_period, processing_date, state
            )
            SELECT
                ccn,
                extract_id,
                as_of_date,
                measure_code,
                measure_description,
                CASE
                    WHEN LOWER(resident_type) LIKE '%long%' THEN 'long_stay'
                    WHEN LOWER(resident_type) LIKE '%short%' THEN 'short_stay'
                    ELSE LOWER(REPLACE(COALESCE(resident_type, ''), ' ', '_'))
                END,
                q1_score, q2_score, q3_score, q4_score, four_quarter_avg,
                jsonb_build_object(
                    'q1', q1_footnote,
                    'q2', q2_footnote,
                    'q3', q3_footnote,
                    'q4', q4_footnote,
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
            ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
                as_of_date = EXCLUDED.as_of_date,
                measure_description = EXCLUDED.measure_description,
                resident_type = EXCLUDED.resident_type,
                q1_score = EXCLUDED.q1_score,
                q2_score = EXCLUDED.q2_score,
                q3_score = EXCLUDED.q3_score,
                q4_score = EXCLUDED.q4_score,
                four_quarter_avg = EXCLUDED.four_quarter_avg,
                footnotes = EXCLUDED.footnotes,
                has_suppression = EXCLUDED.has_suppression,
                used_in_star_rating = EXCLUDED.used_in_star_rating,
                measure_period = EXCLUDED.measure_period,
                processing_date = EXCLUDED.processing_date,
                state = EXCLUDED.state
        """)
        mds_count = cur.rowcount

        # Transform Claims
        cur.execute("""
            INSERT INTO gold.nh_quality_claims (
                ccn, extract_id, as_of_date, measure_code, measure_description,
                resident_type, adjusted_score, observed_score, expected_score,
                footnote, has_suppression, used_in_star_rating, measure_period,
                processing_date, state
            )
            SELECT
                ccn,
                extract_id,
                as_of_date,
                measure_code,
                measure_description,
                CASE
                    WHEN LOWER(resident_type) LIKE '%long%' THEN 'long_stay'
                    WHEN LOWER(resident_type) LIKE '%short%' THEN 'short_stay'
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
            ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
                as_of_date = EXCLUDED.as_of_date,
                measure_description = EXCLUDED.measure_description,
                resident_type = EXCLUDED.resident_type,
                adjusted_score = EXCLUDED.adjusted_score,
                observed_score = EXCLUDED.observed_score,
                expected_score = EXCLUDED.expected_score,
                footnote = EXCLUDED.footnote,
                has_suppression = EXCLUDED.has_suppression,
                used_in_star_rating = EXCLUDED.used_in_star_rating,
                measure_period = EXCLUDED.measure_period,
                processing_date = EXCLUDED.processing_date,
                state = EXCLUDED.state
        """)
        claims_count = cur.rowcount

        conn.commit()

    logger.info(f"  -> MDS: {mds_count:,}, Claims: {claims_count:,}")
    return mds_count, claims_count


def update_extract_metadata(conn):
    """Update the extracts metadata table."""
    logger.info("Updating extract metadata...")

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO gold.nh_quality_extracts (
                extract_id, as_of_date, mds_row_count, claims_row_count,
                mds_facility_count, claims_facility_count, mds_source_file, claims_source_file
            )
            SELECT
                COALESCE(m.extract_id, c.extract_id) as extract_id,
                COALESCE(m.as_of_date, c.as_of_date) as as_of_date,
                m.mds_count,
                c.claims_count,
                m.mds_facilities,
                c.claims_facilities,
                m.source_file,
                c.source_file
            FROM (
                SELECT extract_id, MIN(as_of_date) as as_of_date,
                       COUNT(*) as mds_count, COUNT(DISTINCT ccn) as mds_facilities,
                       MIN(source_file) as source_file
                FROM staging.nh_quality_mds_raw
                GROUP BY extract_id
            ) m
            FULL OUTER JOIN (
                SELECT extract_id, MIN(as_of_date) as as_of_date,
                       COUNT(*) as claims_count, COUNT(DISTINCT ccn) as claims_facilities,
                       MIN(source_file) as source_file
                FROM staging.nh_quality_claims_raw
                GROUP BY extract_id
            ) c ON m.extract_id = c.extract_id
            ON CONFLICT (extract_id) DO UPDATE SET
                as_of_date = EXCLUDED.as_of_date,
                mds_row_count = EXCLUDED.mds_row_count,
                claims_row_count = EXCLUDED.claims_row_count,
                mds_facility_count = EXCLUDED.mds_facility_count,
                claims_facility_count = EXCLUDED.claims_facility_count,
                mds_source_file = EXCLUDED.mds_source_file,
                claims_source_file = EXCLUDED.claims_source_file,
                updated_at = NOW()
        """)
        conn.commit()

    logger.info("  -> Done")


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

    logger.info("  -> Schema setup complete")
    return True


def log_ingestion_start(conn, run_id: str) -> int:
    """Log the start of an ingestion run. Returns log ID."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO gold.nh_ingest_log (run_id, started_at, status)
            VALUES (%s, NOW(), 'running')
            RETURNING id
        """, (run_id,))
        log_id = cur.fetchone()[0]
    conn.commit()
    return log_id


def log_ingestion_complete(conn, log_id: int, files_processed: int, mds_rows: int, claims_rows: int, errors: List[str]):
    """Log completion of ingestion run."""
    status = 'completed' if not errors else 'completed_with_errors'
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE gold.nh_ingest_log
            SET completed_at = NOW(),
                status = %s,
                files_processed = %s,
                mds_rows_inserted = %s,
                claims_rows_inserted = %s,
                errors = %s
            WHERE id = %s
        """, (status, files_processed, mds_rows, claims_rows, errors if errors else None, log_id))
    conn.commit()


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Ingest CMS Quality Measures to Marketplace DB')
    parser.add_argument('--data-dir', help='Path to cms_historical_data folder')
    parser.add_argument('--db-url', default=DEFAULT_DB_URL, help='PostgreSQL connection URL')
    parser.add_argument('--dry-run', action='store_true', help='Parse files but do not insert')
    parser.add_argument('--limit', type=int, help='Limit number of months to process')
    parser.add_argument('--setup-schema', action='store_true', help='Run schema setup only')
    parser.add_argument('--skip-transform', action='store_true', help='Skip staging-to-gold transformation')

    args = parser.parse_args()

    # Connect to database
    logger.info(f"Connecting to marketplace database...")
    conn = psycopg2.connect(args.db_url)

    try:
        # Schema setup only
        if args.setup_schema:
            if run_schema_setup(conn):
                logger.info("Schema setup complete. Run again with --data-dir to ingest data.")
                return 0
            return 1

        # Need data directory for ingestion
        if not args.data_dir:
            logger.error("--data-dir required for ingestion. Use --setup-schema for schema only.")
            return 1

        if not Path(args.data_dir).exists():
            logger.error(f"Data directory not found: {args.data_dir}")
            return 1

        # Discover files
        logger.info(f"Discovering files in: {args.data_dir}")
        mds_files, claims_files = discover_quality_files(args.data_dir)
        logger.info(f"Found {len(mds_files)} MDS files and {len(claims_files)} Claims files")

        if args.limit:
            mds_files = mds_files[:args.limit]
            claims_files = claims_files[:args.limit]
            logger.info(f"Limited to {args.limit} months each")

        if args.dry_run:
            logger.info("DRY RUN: Parsing files without database insertion")
            total_mds = 0
            total_claims = 0

            for filepath, filename in mds_files:
                df = load_mds_dataframe(filepath, filename)
                total_mds += len(df)

            for filepath, filename in claims_files:
                df = load_claims_dataframe(filepath, filename)
                total_claims += len(df)

            logger.info(f"Would insert {total_mds:,} MDS records and {total_claims:,} Claims records")
            return 0

        # Start ingestion
        run_id = f"ingest_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        log_id = log_ingestion_start(conn, run_id)
        logger.info(f"Ingestion run: {run_id}")

        errors = []
        total_mds_rows = 0
        total_claims_rows = 0
        files_processed = 0

        # Process MDS files
        for filepath, filename in mds_files:
            try:
                df = load_mds_dataframe(filepath, filename)
                rows = upsert_staging_mds(conn, df)
                total_mds_rows += rows
                files_processed += 1
            except Exception as e:
                error_msg = f"Error processing {filename}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)

        # Process Claims files
        for filepath, filename in claims_files:
            try:
                df = load_claims_dataframe(filepath, filename)
                rows = upsert_staging_claims(conn, df)
                total_claims_rows += rows
                files_processed += 1
            except Exception as e:
                error_msg = f"Error processing {filename}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)

        # Transform to gold
        if not args.skip_transform:
            transform_staging_to_gold(conn)
            update_extract_metadata(conn)

        # Log completion
        log_ingestion_complete(conn, log_id, files_processed, total_mds_rows, total_claims_rows, errors)

        logger.info(f"Ingestion complete!")
        logger.info(f"  Files processed: {files_processed}")
        logger.info(f"  MDS rows: {total_mds_rows:,}")
        logger.info(f"  Claims rows: {total_claims_rows:,}")
        if errors:
            logger.warning(f"  Errors: {len(errors)}")

        return 0 if not errors else 1

    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
