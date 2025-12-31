#!/usr/bin/env python3
"""
NH-IR-007: CRID (Clinical Reporting Integrity Divergence) Materialization

Materializes metrics.crid_monthly from gold.nh_quality_mds and gold.nh_quality_claims.

Usage:
    python materialize_crid.py                    # Full materialization + validation
    python materialize_crid.py --validate         # Validation only (no rebuild)
    python materialize_crid.py --dry-run          # Show SQL without executing
    python materialize_crid.py --volatility-window 4   # Use 4-month rolling stddev

CRID Formula:
    MDS_Composite = w1×(410) + w2×(453) + w3×(407) + w4×(409)
    Claims_Utilization = w5×(551) + w6×(552)
    CRID = z(MDS_Composite) - z(Claims_Utilization)

Weights are pulled from gold.nh_measure_definitions.crid_weight.
Z-scores are computed within (state, extract_id) for peer comparison.

Handling of edge cases:
    - Missing/suppressed measures: CRID = NULL, flag = INCOMPLETE_MEASURES, completeness_pct shown
    - Small states (<10 facilities): CRID = NULL, flag = SMALL_STATE (no national fallback)

Expected output after full 60-month ingestion:
    - ~900,000 facility-months total (including NULL CRID rows)
    - ~700,000 with valid CRID values
    - ~12,000 unique facilities per extract
    - Mean CRID ≈ 0, StdDev ≈ 1.4 (due to z-score difference)
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor

# Default to marketplace database
DEFAULT_DB_URL = os.environ.get(
    'MARKET_DATABASE_URL',
    'postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data'
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_connection(db_url: str):
    """Create database connection."""
    return psycopg2.connect(db_url)


def create_schema(conn):
    """Create metrics schema if not exists."""
    with conn.cursor() as cur:
        cur.execute("CREATE SCHEMA IF NOT EXISTS metrics;")
    conn.commit()
    logger.info("Created metrics schema (if not exists)")


def drop_and_create_table(conn):
    """Drop and recreate metrics.crid_monthly table."""
    ddl = """
    DROP TABLE IF EXISTS metrics.crid_monthly CASCADE;

    CREATE TABLE metrics.crid_monthly (
        id SERIAL PRIMARY KEY,
        ccn VARCHAR(6) NOT NULL,
        extract_id VARCHAR(6) NOT NULL,
        as_of_date DATE NOT NULL,
        state VARCHAR(2) NOT NULL,

        -- Raw composite scores (before z-normalization)
        mds_composite NUMERIC(12,6),
        claims_utilization NUMERIC(12,6),

        -- Z-scores (within state, extract_id) - NULL if small state or incomplete
        mds_z_score NUMERIC(12,6),
        claims_z_score NUMERIC(12,6),

        -- CRID value - NULL if incomplete measures or small state
        crid_value NUMERIC(12,6),
        crid_volatility NUMERIC(12,6),

        -- Data completeness
        completeness_pct NUMERIC(5,2),           -- 0-100, % of 6 CRID measures present and not suppressed
        measures_present INTEGER,                 -- Count of measures present (0-6)
        measures_suppressed INTEGER,              -- Count of measures suppressed

        -- Flags (array for multiple flags)
        flags TEXT[],

        -- Component scores for drill-down (NULL if suppressed/missing)
        measure_410_score NUMERIC(12,6),
        measure_453_score NUMERIC(12,6),
        measure_407_score NUMERIC(12,6),
        measure_409_score NUMERIC(12,6),
        measure_551_score NUMERIC(12,6),
        measure_552_score NUMERIC(12,6),

        -- Peer context (NULL if small state)
        state_facility_count INTEGER,
        state_mds_mean NUMERIC(12,6),
        state_mds_stddev NUMERIC(12,6),
        state_claims_mean NUMERIC(12,6),
        state_claims_stddev NUMERIC(12,6),

        -- Metadata
        created_at TIMESTAMP DEFAULT NOW(),

        CONSTRAINT crid_monthly_unique UNIQUE (ccn, extract_id)
    );
    """
    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.commit()
    logger.info("Created metrics.crid_monthly table")


def create_indexes(conn):
    """Create indexes on metrics.crid_monthly."""
    indexes = [
        "CREATE INDEX idx_crid_ccn ON metrics.crid_monthly(ccn);",
        "CREATE INDEX idx_crid_extract ON metrics.crid_monthly(extract_id);",
        "CREATE INDEX idx_crid_ccn_extract ON metrics.crid_monthly(ccn, extract_id);",
        "CREATE INDEX idx_crid_state ON metrics.crid_monthly(state);",
        "CREATE INDEX idx_crid_state_extract ON metrics.crid_monthly(state, extract_id);",
        "CREATE INDEX idx_crid_flags ON metrics.crid_monthly USING GIN(flags);",
        "CREATE INDEX idx_crid_high_value ON metrics.crid_monthly(crid_value DESC) WHERE crid_value > 2;",
        "CREATE INDEX idx_crid_low_value ON metrics.crid_monthly(crid_value ASC) WHERE crid_value < -2;",
        "CREATE INDEX idx_crid_volatility ON metrics.crid_monthly(crid_volatility DESC NULLS LAST);",
        "CREATE INDEX idx_crid_as_of_date ON metrics.crid_monthly(as_of_date);",
        "CREATE INDEX idx_crid_completeness ON metrics.crid_monthly(completeness_pct);",
    ]
    with conn.cursor() as cur:
        for idx_sql in indexes:
            cur.execute(idx_sql)
    conn.commit()
    logger.info(f"Created {len(indexes)} indexes")


def materialize_crid(conn, volatility_window: int = 3) -> int:
    """
    Materialize CRID values into metrics.crid_monthly.

    Args:
        volatility_window: Number of months for rolling stddev (3 or 4)

    Returns:
        Number of rows inserted.
    """
    # Validate volatility window
    if volatility_window not in (3, 4):
        raise ValueError(f"volatility_window must be 3 or 4, got {volatility_window}")

    # Window clause: ROWS BETWEEN (N-1) PRECEDING AND CURRENT ROW for N-month window
    window_preceding = volatility_window - 1

    materialize_sql = f"""
    -- Get weights from measure definitions
    WITH measure_weights AS (
        SELECT
            measure_code,
            crid_weight,
            crid_component
        FROM gold.nh_measure_definitions
        WHERE used_in_crid = TRUE
    ),

    -- Get individual weights for use in composite calculations
    weight_values AS (
        SELECT
            MAX(CASE WHEN measure_code = '410' THEN crid_weight END) AS w_410,
            MAX(CASE WHEN measure_code = '453' THEN crid_weight END) AS w_453,
            MAX(CASE WHEN measure_code = '407' THEN crid_weight END) AS w_407,
            MAX(CASE WHEN measure_code = '409' THEN crid_weight END) AS w_409,
            MAX(CASE WHEN measure_code = '551' THEN crid_weight END) AS w_551,
            MAX(CASE WHEN measure_code = '552' THEN crid_weight END) AS w_552
        FROM measure_weights
    ),

    -- Pivot MDS measures (410, 453, 407, 409) with suppression tracking
    mds_base AS (
        SELECT
            m.ccn,
            m.extract_id,
            m.as_of_date,
            m.state,
            MAX(CASE WHEN m.measure_code = '410' THEN m.four_quarter_avg END) AS measure_410,
            MAX(CASE WHEN m.measure_code = '453' THEN m.four_quarter_avg END) AS measure_453,
            MAX(CASE WHEN m.measure_code = '407' THEN m.four_quarter_avg END) AS measure_407,
            MAX(CASE WHEN m.measure_code = '409' THEN m.four_quarter_avg END) AS measure_409,
            -- Track which measures are suppressed
            MAX(CASE WHEN m.measure_code = '410' AND m.has_suppression THEN 1 ELSE 0 END) AS sup_410,
            MAX(CASE WHEN m.measure_code = '453' AND m.has_suppression THEN 1 ELSE 0 END) AS sup_453,
            MAX(CASE WHEN m.measure_code = '407' AND m.has_suppression THEN 1 ELSE 0 END) AS sup_407,
            MAX(CASE WHEN m.measure_code = '409' AND m.has_suppression THEN 1 ELSE 0 END) AS sup_409
        FROM gold.nh_quality_mds m
        WHERE m.measure_code IN ('410', '453', '407', '409')
        GROUP BY m.ccn, m.extract_id, m.as_of_date, m.state
    ),

    -- Pivot Claims measures (551, 552) with suppression tracking
    claims_base AS (
        SELECT
            c.ccn,
            c.extract_id,
            MAX(CASE WHEN c.measure_code = '551' THEN c.adjusted_score END) AS measure_551,
            MAX(CASE WHEN c.measure_code = '552' THEN c.adjusted_score END) AS measure_552,
            MAX(CASE WHEN c.measure_code = '551' AND c.has_suppression THEN 1 ELSE 0 END) AS sup_551,
            MAX(CASE WHEN c.measure_code = '552' AND c.has_suppression THEN 1 ELSE 0 END) AS sup_552
        FROM gold.nh_quality_claims c
        WHERE c.measure_code IN ('551', '552')
        GROUP BY c.ccn, c.extract_id
    ),

    -- Join and calculate completeness
    all_facilities AS (
        SELECT
            m.ccn,
            m.extract_id,
            m.as_of_date,
            m.state,
            m.measure_410,
            m.measure_453,
            m.measure_407,
            m.measure_409,
            COALESCE(c.measure_551, NULL) AS measure_551,
            COALESCE(c.measure_552, NULL) AS measure_552,
            -- Count present (non-null, non-suppressed)
            (CASE WHEN m.measure_410 IS NOT NULL AND m.sup_410 = 0 THEN 1 ELSE 0 END +
             CASE WHEN m.measure_453 IS NOT NULL AND m.sup_453 = 0 THEN 1 ELSE 0 END +
             CASE WHEN m.measure_407 IS NOT NULL AND m.sup_407 = 0 THEN 1 ELSE 0 END +
             CASE WHEN m.measure_409 IS NOT NULL AND m.sup_409 = 0 THEN 1 ELSE 0 END +
             CASE WHEN c.measure_551 IS NOT NULL AND COALESCE(c.sup_551, 0) = 0 THEN 1 ELSE 0 END +
             CASE WHEN c.measure_552 IS NOT NULL AND COALESCE(c.sup_552, 0) = 0 THEN 1 ELSE 0 END
            ) AS measures_present,
            -- Count suppressed
            (m.sup_410 + m.sup_453 + m.sup_407 + m.sup_409 +
             COALESCE(c.sup_551, 0) + COALESCE(c.sup_552, 0)
            ) AS measures_suppressed,
            -- Is complete?
            (CASE WHEN m.measure_410 IS NOT NULL AND m.sup_410 = 0
                   AND m.measure_453 IS NOT NULL AND m.sup_453 = 0
                   AND m.measure_407 IS NOT NULL AND m.sup_407 = 0
                   AND m.measure_409 IS NOT NULL AND m.sup_409 = 0
                   AND c.measure_551 IS NOT NULL AND COALESCE(c.sup_551, 0) = 0
                   AND c.measure_552 IS NOT NULL AND COALESCE(c.sup_552, 0) = 0
             THEN TRUE ELSE FALSE END) AS is_complete
        FROM mds_base m
        LEFT JOIN claims_base c ON m.ccn = c.ccn AND m.extract_id = c.extract_id
    ),

    -- Calculate composites for complete facilities only (using weights from table)
    with_composites AS (
        SELECT
            f.*,
            ROUND(f.measures_present * 100.0 / 6, 2) AS completeness_pct,
            CASE WHEN f.is_complete THEN
                (w.w_410 * f.measure_410 + w.w_453 * f.measure_453 +
                 w.w_407 * f.measure_407 + w.w_409 * f.measure_409)
            END AS mds_composite,
            CASE WHEN f.is_complete THEN
                (w.w_551 * f.measure_551 + w.w_552 * f.measure_552)
            END AS claims_utilization
        FROM all_facilities f
        CROSS JOIN weight_values w
    ),

    -- Calculate state-level statistics (only from complete facilities)
    state_stats AS (
        SELECT
            state,
            extract_id,
            COUNT(*) AS facility_count,
            AVG(mds_composite) AS mds_mean,
            STDDEV_POP(mds_composite) AS mds_stddev,
            AVG(claims_utilization) AS claims_mean,
            STDDEV_POP(claims_utilization) AS claims_stddev
        FROM with_composites
        WHERE is_complete = TRUE
        GROUP BY state, extract_id
    ),

    -- Calculate z-scores (NULL for incomplete or small state)
    with_z_scores AS (
        SELECT
            f.ccn,
            f.extract_id,
            f.as_of_date,
            f.state,
            f.mds_composite,
            f.claims_utilization,
            f.measure_410,
            f.measure_453,
            f.measure_407,
            f.measure_409,
            f.measure_551,
            f.measure_552,
            f.measures_present,
            f.measures_suppressed,
            f.completeness_pct,
            f.is_complete,
            s.facility_count AS state_facility_count,
            s.mds_mean AS state_mds_mean,
            s.mds_stddev AS state_mds_stddev,
            s.claims_mean AS state_claims_mean,
            s.claims_stddev AS state_claims_stddev,
            -- Small state flag (< 10 complete facilities)
            (COALESCE(s.facility_count, 0) < 10) AS is_small_state,
            -- Z-scores: NULL if incomplete OR small state
            CASE
                WHEN f.is_complete AND s.facility_count >= 10 AND s.mds_stddev > 0
                THEN (f.mds_composite - s.mds_mean) / s.mds_stddev
                ELSE NULL
            END AS mds_z_score,
            CASE
                WHEN f.is_complete AND s.facility_count >= 10 AND s.claims_stddev > 0
                THEN (f.claims_utilization - s.claims_mean) / s.claims_stddev
                ELSE NULL
            END AS claims_z_score
        FROM with_composites f
        LEFT JOIN state_stats s ON f.state = s.state AND f.extract_id = s.extract_id
    ),

    -- Calculate CRID and volatility
    with_crid AS (
        SELECT
            *,
            -- CRID: NULL if z-scores are NULL
            CASE
                WHEN mds_z_score IS NOT NULL AND claims_z_score IS NOT NULL
                THEN (mds_z_score - claims_z_score)
                ELSE NULL
            END AS crid_value,
            -- Volatility: rolling stddev (only for valid CRID values)
            -- Order by extract_id as integer for correct temporal ordering
            CASE
                WHEN mds_z_score IS NOT NULL AND claims_z_score IS NOT NULL
                THEN STDDEV_POP(mds_z_score - claims_z_score) OVER (
                    PARTITION BY ccn
                    ORDER BY extract_id::int
                    ROWS BETWEEN {window_preceding} PRECEDING AND CURRENT ROW
                )
                ELSE NULL
            END AS crid_volatility
        FROM with_z_scores
    )

    -- Final insert with flags
    INSERT INTO metrics.crid_monthly (
        ccn, extract_id, as_of_date, state,
        mds_composite, claims_utilization,
        mds_z_score, claims_z_score, crid_value, crid_volatility,
        completeness_pct, measures_present, measures_suppressed,
        flags,
        measure_410_score, measure_453_score, measure_407_score, measure_409_score,
        measure_551_score, measure_552_score,
        state_facility_count, state_mds_mean, state_mds_stddev,
        state_claims_mean, state_claims_stddev
    )
    SELECT
        ccn, extract_id, as_of_date, state,
        mds_composite, claims_utilization,
        mds_z_score, claims_z_score, crid_value, crid_volatility,
        completeness_pct, measures_present, measures_suppressed,
        -- Generate flags array
        ARRAY_REMOVE(ARRAY[
            -- Completeness flags
            CASE WHEN NOT is_complete THEN 'INCOMPLETE_MEASURES' END,
            CASE WHEN is_small_state THEN 'SMALL_STATE' END,
            -- CRID magnitude flags (only if CRID is valid)
            CASE WHEN crid_value > 2 THEN 'HIGH_POSITIVE_CRID' END,
            CASE WHEN crid_value < -2 THEN 'HIGH_NEGATIVE_CRID' END,
            CASE WHEN crid_value > 3 THEN 'EXTREME_POSITIVE_CRID' END,
            CASE WHEN crid_value < -3 THEN 'EXTREME_NEGATIVE_CRID' END,
            -- Volatility flag
            CASE WHEN crid_volatility > 1.5 THEN 'HIGH_VOLATILITY' END,
            -- Component outlier flags
            CASE WHEN ABS(mds_z_score) > 2 AND ABS(claims_z_score) < 1 THEN 'MDS_OUTLIER' END,
            CASE WHEN ABS(claims_z_score) > 2 AND ABS(mds_z_score) < 1 THEN 'CLAIMS_OUTLIER' END
        ], NULL) AS flags,
        measure_410, measure_453, measure_407, measure_409,
        measure_551, measure_552,
        state_facility_count, state_mds_mean, state_mds_stddev,
        state_claims_mean, state_claims_stddev
    FROM with_crid;
    """

    with conn.cursor() as cur:
        cur.execute(materialize_sql)
        rows_inserted = cur.rowcount
    conn.commit()
    return rows_inserted


def run_validation(conn) -> bool:
    """Run validation queries and print summary."""
    print("\n" + "=" * 70)
    print("CRID MATERIALIZATION VALIDATION")
    print("=" * 70)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # 1. Overall summary
        cur.execute("""
            SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT ccn) AS unique_facilities,
                COUNT(DISTINCT extract_id) AS extracts,
                MIN(as_of_date) AS earliest,
                MAX(as_of_date) AS latest,
                COUNT(*) FILTER (WHERE crid_value IS NOT NULL) AS rows_with_crid,
                COUNT(*) FILTER (WHERE crid_value IS NULL) AS rows_without_crid
            FROM metrics.crid_monthly
        """)
        summary = cur.fetchone()
        print(f"\n[1] SUMMARY:")
        print(f"    Total rows:         {summary['total_rows']:,}")
        print(f"    With valid CRID:    {summary['rows_with_crid']:,}")
        print(f"    Without CRID (NULL): {summary['rows_without_crid']:,}")
        print(f"    Unique facilities:  {summary['unique_facilities']:,}")
        print(f"    Extracts:           {summary['extracts']}")
        print(f"    Date range:         {summary['earliest']} to {summary['latest']}")

        # 2. CRID distribution (only for non-NULL)
        cur.execute("""
            SELECT
                ROUND(AVG(crid_value)::numeric, 4) AS mean_crid,
                ROUND(STDDEV(crid_value)::numeric, 4) AS stddev_crid,
                ROUND(MIN(crid_value)::numeric, 4) AS min_crid,
                ROUND(MAX(crid_value)::numeric, 4) AS max_crid,
                ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY crid_value)::numeric, 4) AS p25,
                ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY crid_value)::numeric, 4) AS median,
                ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY crid_value)::numeric, 4) AS p75
            FROM metrics.crid_monthly
            WHERE crid_value IS NOT NULL
        """)
        dist = cur.fetchone()
        print(f"\n[2] CRID DISTRIBUTION (non-NULL only):")
        print(f"    Mean:   {dist['mean_crid']} (should be ~0)")
        print(f"    StdDev: {dist['stddev_crid']} (typically ~1.4)")
        print(f"    Min:    {dist['min_crid']}")
        print(f"    Max:    {dist['max_crid']}")
        print(f"    P25:    {dist['p25']}")
        print(f"    Median: {dist['median']}")
        print(f"    P75:    {dist['p75']}")

        # Sanity check: mean should be close to 0
        if dist['mean_crid'] is not None and abs(float(dist['mean_crid'])) > 0.5:
            print(f"    WARNING: Mean CRID is far from 0, check z-score calculation")

        # 3. Flag distribution
        cur.execute("""
            SELECT
                unnest(flags) AS flag,
                COUNT(*) AS occurrences,
                ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM metrics.crid_monthly), 2) AS pct
            FROM metrics.crid_monthly
            WHERE flags IS NOT NULL AND array_length(flags, 1) > 0
            GROUP BY unnest(flags)
            ORDER BY occurrences DESC
        """)
        flags = cur.fetchall()
        print(f"\n[3] FLAG DISTRIBUTION:")
        if flags:
            for f in flags:
                print(f"    {f['flag']}: {f['occurrences']:,} ({f['pct']}%)")
        else:
            print(f"    No flags assigned")

        # 4. Completeness distribution
        cur.execute("""
            SELECT
                CASE
                    WHEN completeness_pct = 100 THEN '100% (complete)'
                    WHEN completeness_pct >= 83 THEN '83-99% (5 measures)'
                    WHEN completeness_pct >= 67 THEN '67-82% (4 measures)'
                    ELSE '<67% (3 or fewer)'
                END AS completeness_bucket,
                COUNT(*) AS count,
                ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
            FROM metrics.crid_monthly
            GROUP BY 1
            ORDER BY 1 DESC
        """)
        completeness = cur.fetchall()
        print(f"\n[4] COMPLETENESS DISTRIBUTION:")
        for c in completeness:
            print(f"    {c['completeness_bucket']}: {c['count']:,} ({c['pct']}%)")

        # 5. NULL CRID reasons
        cur.execute("""
            SELECT
                CASE
                    WHEN 'INCOMPLETE_MEASURES' = ANY(flags) AND 'SMALL_STATE' = ANY(flags)
                        THEN 'Both: incomplete + small state'
                    WHEN 'INCOMPLETE_MEASURES' = ANY(flags) THEN 'Incomplete measures'
                    WHEN 'SMALL_STATE' = ANY(flags) THEN 'Small state (<10 facilities)'
                    ELSE 'Other/Unknown'
                END AS null_reason,
                COUNT(*) AS count
            FROM metrics.crid_monthly
            WHERE crid_value IS NULL
            GROUP BY 1
            ORDER BY count DESC
        """)
        null_reasons = cur.fetchall()
        print(f"\n[5] NULL CRID REASONS:")
        for r in null_reasons:
            print(f"    {r['null_reason']}: {r['count']:,}")

        # 6. Coverage by extract (first 5 and last 5)
        cur.execute("""
            SELECT
                extract_id,
                as_of_date,
                COUNT(*) AS total_facilities,
                COUNT(*) FILTER (WHERE crid_value IS NOT NULL) AS with_crid,
                ROUND(AVG(crid_value)::numeric, 4) AS avg_crid
            FROM metrics.crid_monthly
            GROUP BY extract_id, as_of_date
            ORDER BY extract_id::int
        """)
        extracts = cur.fetchall()
        print(f"\n[6] COVERAGE BY EXTRACT (first 5 and last 5):")
        for e in extracts[:5]:
            print(f"    {e['extract_id']}: {e['with_crid']:,}/{e['total_facilities']:,} with CRID, avg={e['avg_crid']}")
        if len(extracts) > 10:
            print(f"    ...")
        for e in extracts[-5:]:
            print(f"    {e['extract_id']}: {e['with_crid']:,}/{e['total_facilities']:,} with CRID, avg={e['avg_crid']}")

        # 7. Verify weights from measure_definitions
        cur.execute("""
            SELECT measure_code, crid_weight, crid_component
            FROM gold.nh_measure_definitions
            WHERE used_in_crid = TRUE
            ORDER BY crid_component, measure_code
        """)
        weights = cur.fetchall()
        print(f"\n[7] WEIGHTS FROM gold.nh_measure_definitions:")
        for w in weights:
            print(f"    {w['measure_code']} ({w['crid_component']}): {w['crid_weight']}")

        # 8. Top 10 highest CRID (latest extract)
        cur.execute("""
            WITH latest AS (
                SELECT MAX(extract_id) AS extract_id FROM metrics.crid_monthly
            )
            SELECT
                c.ccn,
                c.state,
                ROUND(c.crid_value::numeric, 3) AS crid,
                ROUND(c.mds_z_score::numeric, 3) AS mds_z,
                ROUND(c.claims_z_score::numeric, 3) AS claims_z,
                c.completeness_pct
            FROM metrics.crid_monthly c
            JOIN latest l ON c.extract_id = l.extract_id
            WHERE c.crid_value IS NOT NULL
            ORDER BY c.crid_value DESC
            LIMIT 10
        """)
        top_crid = cur.fetchall()
        print(f"\n[8] TOP 10 HIGHEST CRID (latest extract):")
        for t in top_crid:
            print(f"    {t['ccn']} ({t['state']}): CRID={t['crid']}, MDS_z={t['mds_z']}, Claims_z={t['claims_z']}")

    print("\n" + "=" * 70)
    print("VALIDATION COMPLETE")
    print("=" * 70 + "\n")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='Materialize NH-IR-007 CRID into metrics.crid_monthly'
    )
    parser.add_argument(
        '--db-url',
        default=DEFAULT_DB_URL,
        help='PostgreSQL connection URL'
    )
    parser.add_argument(
        '--validate',
        action='store_true',
        help='Run validation only (skip materialization)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print SQL without executing'
    )
    parser.add_argument(
        '--volatility-window',
        type=int,
        default=3,
        choices=[3, 4],
        help='Number of months for volatility rolling stddev (default: 3)'
    )

    args = parser.parse_args()

    if args.dry_run:
        # Read and print the SQL file
        sql_path = os.path.join(os.path.dirname(__file__), 'crid_materialize.sql')
        with open(sql_path, 'r') as f:
            print(f.read())
        return

    logger.info("Connecting to marketplace database...")
    conn = get_connection(args.db_url)

    try:
        if args.validate:
            run_validation(conn)
        else:
            start_time = time.time()

            logger.info("Creating schema...")
            create_schema(conn)

            logger.info("Creating table...")
            drop_and_create_table(conn)

            logger.info(f"Materializing CRID values (volatility window: {args.volatility_window} months)...")
            logger.info("This may take 2-5 minutes...")
            rows = materialize_crid(conn, volatility_window=args.volatility_window)
            logger.info(f"Inserted {rows:,} rows")

            logger.info("Creating indexes...")
            create_indexes(conn)

            elapsed = time.time() - start_time
            logger.info(f"Materialization complete in {elapsed:.1f} seconds")

            # Run validation
            run_validation(conn)

    finally:
        conn.close()


if __name__ == '__main__':
    main()
