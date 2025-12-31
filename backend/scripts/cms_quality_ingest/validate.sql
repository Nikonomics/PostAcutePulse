-- ============================================================================
-- CMS Quality Measures Validation Queries
-- Target: snf_market_data (Marketplace Database)
-- Run these after ingestion to verify data integrity
-- ============================================================================

-- ============================================================================
-- 1. ROW COUNTS BY TABLE
-- ============================================================================

-- Overall counts
SELECT 'staging.nh_quality_mds_raw' as table_name, COUNT(*) as row_count FROM staging.nh_quality_mds_raw
UNION ALL
SELECT 'staging.nh_quality_claims_raw', COUNT(*) FROM staging.nh_quality_claims_raw
UNION ALL
SELECT 'gold.nh_quality_mds', COUNT(*) FROM gold.nh_quality_mds
UNION ALL
SELECT 'gold.nh_quality_claims', COUNT(*) FROM gold.nh_quality_claims
UNION ALL
SELECT 'gold.nh_quality_extracts', COUNT(*) FROM gold.nh_quality_extracts
UNION ALL
SELECT 'gold.nh_ingest_log', COUNT(*) FROM gold.nh_ingest_log;

-- ============================================================================
-- 2. ROW COUNTS BY EXTRACT_ID
-- ============================================================================

-- MDS counts by extract
SELECT
    extract_id,
    as_of_date,
    COUNT(*) as mds_rows,
    COUNT(DISTINCT ccn) as facilities,
    COUNT(DISTINCT measure_code) as measures
FROM gold.nh_quality_mds
GROUP BY extract_id, as_of_date
ORDER BY extract_id;

-- Claims counts by extract
SELECT
    extract_id,
    as_of_date,
    COUNT(*) as claims_rows,
    COUNT(DISTINCT ccn) as facilities,
    COUNT(DISTINCT measure_code) as measures
FROM gold.nh_quality_claims
GROUP BY extract_id, as_of_date
ORDER BY extract_id;

-- ============================================================================
-- 3. EXTRACTS SUMMARY
-- ============================================================================

-- List all extracts with counts
SELECT
    extract_id,
    as_of_date,
    mds_row_count,
    claims_row_count,
    mds_facility_count,
    claims_facility_count,
    mds_source_file,
    claims_source_file,
    imported_at
FROM gold.nh_quality_extracts
ORDER BY extract_id;

-- ============================================================================
-- 4. MISSING MONTH DETECTION
-- ============================================================================

-- Generate expected months and find gaps
WITH date_range AS (
    SELECT generate_series(
        '2020-01-01'::date,
        CURRENT_DATE,
        '1 month'::interval
    )::date as expected_date
),
expected_extracts AS (
    SELECT
        TO_CHAR(expected_date, 'YYYYMM') as expected_extract_id,
        expected_date as expected_as_of_date
    FROM date_range
),
actual_extracts AS (
    SELECT DISTINCT extract_id FROM gold.nh_quality_extracts
)
SELECT
    e.expected_extract_id as missing_extract_id,
    e.expected_as_of_date as missing_month,
    'MISSING' as status
FROM expected_extracts e
LEFT JOIN actual_extracts a ON e.expected_extract_id = a.extract_id
WHERE a.extract_id IS NULL
  AND e.expected_as_of_date <= (SELECT MAX(as_of_date) FROM gold.nh_quality_extracts)
ORDER BY e.expected_extract_id;

-- Count missing months
SELECT
    COUNT(*) as missing_month_count,
    MIN(expected_extract_id) as first_missing,
    MAX(expected_extract_id) as last_missing
FROM (
    WITH date_range AS (
        SELECT generate_series(
            '2020-01-01'::date,
            CURRENT_DATE,
            '1 month'::interval
        )::date as expected_date
    ),
    expected_extracts AS (
        SELECT
            TO_CHAR(expected_date, 'YYYYMM') as expected_extract_id,
            expected_date as expected_as_of_date
        FROM date_range
    ),
    actual_extracts AS (
        SELECT DISTINCT extract_id FROM gold.nh_quality_extracts
    )
    SELECT e.expected_extract_id
    FROM expected_extracts e
    LEFT JOIN actual_extracts a ON e.expected_extract_id = a.extract_id
    WHERE a.extract_id IS NULL
      AND e.expected_as_of_date <= (SELECT MAX(as_of_date) FROM gold.nh_quality_extracts)
) missing;

-- ============================================================================
-- 5. DUPLICATE DETECTION
-- ============================================================================

-- Check for duplicates in staging tables
SELECT
    'staging.nh_quality_mds_raw duplicates' as check_name,
    COUNT(*) as duplicate_count
FROM (
    SELECT extract_id, ccn, measure_code, COUNT(*) as cnt
    FROM staging.nh_quality_mds_raw
    GROUP BY extract_id, ccn, measure_code
    HAVING COUNT(*) > 1
) dups
UNION ALL
SELECT
    'staging.nh_quality_claims_raw duplicates',
    COUNT(*)
FROM (
    SELECT extract_id, ccn, measure_code, COUNT(*) as cnt
    FROM staging.nh_quality_claims_raw
    GROUP BY extract_id, ccn, measure_code
    HAVING COUNT(*) > 1
) dups;

-- Check for duplicates in gold tables
SELECT
    'gold.nh_quality_mds duplicates' as check_name,
    COUNT(*) as duplicate_count
FROM (
    SELECT extract_id, ccn, measure_code, COUNT(*) as cnt
    FROM gold.nh_quality_mds
    GROUP BY extract_id, ccn, measure_code
    HAVING COUNT(*) > 1
) dups
UNION ALL
SELECT
    'gold.nh_quality_claims duplicates',
    COUNT(*)
FROM (
    SELECT extract_id, ccn, measure_code, COUNT(*) as cnt
    FROM gold.nh_quality_claims
    GROUP BY extract_id, ccn, measure_code
    HAVING COUNT(*) > 1
) dups;

-- Show actual duplicates if any exist (for debugging)
SELECT 'MDS' as source, extract_id, ccn, measure_code, COUNT(*) as cnt
FROM gold.nh_quality_mds
GROUP BY extract_id, ccn, measure_code
HAVING COUNT(*) > 1
UNION ALL
SELECT 'Claims', extract_id, ccn, measure_code, COUNT(*)
FROM gold.nh_quality_claims
GROUP BY extract_id, ccn, measure_code
HAVING COUNT(*) > 1
LIMIT 20;

-- ============================================================================
-- 6. CCN CONTINUITY SPOT-CHECK
-- ============================================================================

-- Random sample of CCNs to check continuity
WITH sample_ccns AS (
    SELECT DISTINCT ccn
    FROM gold.nh_quality_mds
    ORDER BY RANDOM()
    LIMIT 10
),
ccn_extracts AS (
    SELECT
        s.ccn,
        m.extract_id,
        m.as_of_date
    FROM sample_ccns s
    CROSS JOIN gold.nh_quality_extracts e
    LEFT JOIN gold.nh_quality_mds m ON s.ccn = m.ccn AND e.extract_id = m.extract_id
)
SELECT
    ccn,
    COUNT(*) as expected_extracts,
    COUNT(extract_id) as actual_extracts,
    COUNT(*) - COUNT(extract_id) as missing_extracts
FROM ccn_extracts
GROUP BY ccn
ORDER BY missing_extracts DESC;

-- Detailed view: which extracts are missing for each sample CCN
WITH sample_ccns AS (
    SELECT DISTINCT ccn
    FROM gold.nh_quality_mds
    WHERE ccn IN (
        SELECT ccn FROM gold.nh_quality_mds ORDER BY RANDOM() LIMIT 5
    )
)
SELECT
    s.ccn,
    e.extract_id,
    CASE WHEN m.ccn IS NULL THEN 'MISSING' ELSE 'OK' END as status
FROM sample_ccns s
CROSS JOIN gold.nh_quality_extracts e
LEFT JOIN gold.nh_quality_mds m ON s.ccn = m.ccn AND e.extract_id = m.extract_id
ORDER BY s.ccn, e.extract_id;

-- ============================================================================
-- 7. MEASURE CODE DISTRIBUTION
-- ============================================================================

-- MDS measure codes count
SELECT
    measure_code,
    measure_description,
    resident_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT ccn) as facilities,
    COUNT(DISTINCT extract_id) as extracts,
    ROUND(AVG(four_quarter_avg)::numeric, 2) as avg_score,
    SUM(CASE WHEN has_suppression THEN 1 ELSE 0 END) as suppressed_count
FROM gold.nh_quality_mds
GROUP BY measure_code, measure_description, resident_type
ORDER BY measure_code;

-- Claims measure codes count
SELECT
    measure_code,
    measure_description,
    resident_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT ccn) as facilities,
    COUNT(DISTINCT extract_id) as extracts,
    ROUND(AVG(adjusted_score)::numeric, 4) as avg_adjusted,
    ROUND(AVG(observed_score)::numeric, 4) as avg_observed,
    SUM(CASE WHEN has_suppression THEN 1 ELSE 0 END) as suppressed_count
FROM gold.nh_quality_claims
GROUP BY measure_code, measure_description, resident_type
ORDER BY measure_code;

-- ============================================================================
-- 8. FACILITY COVERAGE BY STATE
-- ============================================================================

-- Facilities per state (from MDS data)
SELECT
    state,
    COUNT(DISTINCT ccn) as facility_count,
    COUNT(DISTINCT extract_id) as extracts_with_data,
    COUNT(*) as total_records
FROM gold.nh_quality_mds
GROUP BY state
ORDER BY facility_count DESC;

-- ============================================================================
-- 9. DATA QUALITY CHECKS
-- ============================================================================

-- Check for null CCNs (should be 0)
SELECT
    'MDS null CCNs' as check_name,
    COUNT(*) as count
FROM gold.nh_quality_mds WHERE ccn IS NULL
UNION ALL
SELECT
    'Claims null CCNs',
    COUNT(*)
FROM gold.nh_quality_claims WHERE ccn IS NULL;

-- Check CCN format (should all be 6 characters)
SELECT
    'MDS CCN length issues' as check_name,
    COUNT(*) as count
FROM gold.nh_quality_mds WHERE LENGTH(ccn) != 6
UNION ALL
SELECT
    'Claims CCN length issues',
    COUNT(*)
FROM gold.nh_quality_claims WHERE LENGTH(ccn) != 6;

-- Check for invalid state codes
SELECT
    'MDS invalid states' as check_name,
    COUNT(*) as count
FROM gold.nh_quality_mds WHERE state IS NULL OR LENGTH(state) != 2
UNION ALL
SELECT
    'Claims invalid states',
    COUNT(*)
FROM gold.nh_quality_claims WHERE state IS NULL OR LENGTH(state) != 2;

-- Suppression rate by measure
SELECT
    'MDS' as source,
    measure_code,
    COUNT(*) as total,
    SUM(CASE WHEN has_suppression THEN 1 ELSE 0 END) as suppressed,
    ROUND(100.0 * SUM(CASE WHEN has_suppression THEN 1 ELSE 0 END) / COUNT(*), 2) as suppression_rate_pct
FROM gold.nh_quality_mds
GROUP BY measure_code
UNION ALL
SELECT
    'Claims',
    measure_code,
    COUNT(*),
    SUM(CASE WHEN has_suppression THEN 1 ELSE 0 END),
    ROUND(100.0 * SUM(CASE WHEN has_suppression THEN 1 ELSE 0 END) / COUNT(*), 2)
FROM gold.nh_quality_claims
GROUP BY measure_code
ORDER BY source, measure_code;

-- ============================================================================
-- 10. CRID-SPECIFIC VALIDATION
-- ============================================================================

-- CRID measure availability (latest extract)
WITH latest AS (
    SELECT MAX(extract_id) as extract_id FROM gold.nh_quality_extracts
)
SELECT
    'MDS 410 (Falls)' as measure,
    COUNT(DISTINCT m.ccn) as facility_count,
    ROUND(AVG(m.four_quarter_avg)::numeric, 2) as avg_score
FROM gold.nh_quality_mds m
JOIN latest l ON m.extract_id = l.extract_id
WHERE m.measure_code = '410'
UNION ALL
SELECT
    'MDS 453 (Pressure Ulcers)',
    COUNT(DISTINCT m.ccn),
    ROUND(AVG(m.four_quarter_avg)::numeric, 2)
FROM gold.nh_quality_mds m
JOIN latest l ON m.extract_id = l.extract_id
WHERE m.measure_code = '453'
UNION ALL
SELECT
    'MDS 407 (UTI)',
    COUNT(DISTINCT m.ccn),
    ROUND(AVG(m.four_quarter_avg)::numeric, 2)
FROM gold.nh_quality_mds m
JOIN latest l ON m.extract_id = l.extract_id
WHERE m.measure_code = '407'
UNION ALL
SELECT
    'MDS 409 (Restraints)',
    COUNT(DISTINCT m.ccn),
    ROUND(AVG(m.four_quarter_avg)::numeric, 2)
FROM gold.nh_quality_mds m
JOIN latest l ON m.extract_id = l.extract_id
WHERE m.measure_code = '409'
UNION ALL
SELECT
    'Claims 551 (Hospitalizations)',
    COUNT(DISTINCT c.ccn),
    ROUND(AVG(c.adjusted_score)::numeric, 4)
FROM gold.nh_quality_claims c
JOIN latest l ON c.extract_id = l.extract_id
WHERE c.measure_code = '551'
UNION ALL
SELECT
    'Claims 552 (ED Visits)',
    COUNT(DISTINCT c.ccn),
    ROUND(AVG(c.adjusted_score)::numeric, 4)
FROM gold.nh_quality_claims c
JOIN latest l ON c.extract_id = l.extract_id
WHERE c.measure_code = '552';

-- Facilities with complete CRID measures (latest extract)
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
SELECT
    (SELECT COUNT(*) FROM crid_mds) as facilities_with_all_mds_crid,
    (SELECT COUNT(*) FROM crid_claims) as facilities_with_all_claims_crid,
    (SELECT COUNT(*) FROM crid_mds m JOIN crid_claims c ON m.ccn = c.ccn) as facilities_with_complete_crid;

-- ============================================================================
-- 11. INGESTION LOG REVIEW
-- ============================================================================

-- Recent ingestion runs
SELECT
    run_id,
    started_at,
    completed_at,
    status,
    files_processed,
    mds_rows_inserted,
    claims_rows_inserted,
    EXTRACT(EPOCH FROM (completed_at - started_at))::int as duration_seconds,
    array_length(errors, 1) as error_count
FROM gold.nh_ingest_log
ORDER BY started_at DESC
LIMIT 10;

-- Failed ingestion runs
SELECT
    run_id,
    started_at,
    status,
    errors
FROM gold.nh_ingest_log
WHERE status = 'failed'
ORDER BY started_at DESC;

-- ============================================================================
-- 12. TIME SERIES VALIDATION
-- ============================================================================

-- Check data continuity across extracts (MDS)
SELECT
    extract_id,
    as_of_date,
    COUNT(DISTINCT ccn) as facilities,
    LAG(COUNT(DISTINCT ccn)) OVER (ORDER BY extract_id) as prev_facilities,
    COUNT(DISTINCT ccn) - LAG(COUNT(DISTINCT ccn)) OVER (ORDER BY extract_id) as change,
    ROUND(100.0 * (COUNT(DISTINCT ccn) - LAG(COUNT(DISTINCT ccn)) OVER (ORDER BY extract_id)) /
          NULLIF(LAG(COUNT(DISTINCT ccn)) OVER (ORDER BY extract_id), 0), 2) as pct_change
FROM gold.nh_quality_mds
GROUP BY extract_id, as_of_date
ORDER BY extract_id;

-- ============================================================================
-- 13. SPOT CHECK: SAMPLE FACILITY DATA
-- ============================================================================

-- Sample MDS data for a random facility
WITH sample_facility AS (
    SELECT ccn FROM gold.nh_quality_mds ORDER BY RANDOM() LIMIT 1
)
SELECT
    m.ccn,
    m.extract_id,
    m.as_of_date,
    m.measure_code,
    m.measure_description,
    m.q1_score,
    m.q2_score,
    m.q3_score,
    m.q4_score,
    m.four_quarter_avg,
    m.has_suppression
FROM gold.nh_quality_mds m
JOIN sample_facility s ON m.ccn = s.ccn
ORDER BY m.extract_id DESC, m.measure_code
LIMIT 30;

-- ============================================================================
-- 14. OVERALL SUMMARY
-- ============================================================================

SELECT
    (SELECT MIN(as_of_date) FROM gold.nh_quality_extracts) as earliest_extract,
    (SELECT MAX(as_of_date) FROM gold.nh_quality_extracts) as latest_extract,
    (SELECT COUNT(*) FROM gold.nh_quality_extracts) as total_extracts,
    (SELECT COUNT(DISTINCT ccn) FROM gold.nh_quality_mds) as unique_facilities_mds,
    (SELECT COUNT(DISTINCT ccn) FROM gold.nh_quality_claims) as unique_facilities_claims,
    (SELECT COUNT(*) FROM gold.nh_quality_mds) as total_mds_records,
    (SELECT COUNT(*) FROM gold.nh_quality_claims) as total_claims_records,
    (SELECT COUNT(*) FROM gold.nh_measure_definitions) as measure_definitions;
