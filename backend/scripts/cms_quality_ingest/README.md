# CMS Quality Measures Ingestion

Ingests CMS Nursing Home Quality Measure data from local CSV files into the **snf_market_data** (marketplace) PostgreSQL database.

## Quick Start: Full Ingestion

```bash
# 1. Setup schema (first time only)
python ingest_fast.py --setup-schema

# 2. Run full ingestion (recommended: 2 workers)
python ingest_fast.py \
    --data-dir /Users/nikolashulewsky/Desktop/cms_historical_data \
    --workers 2

# 3. Validation runs automatically after ingestion
# Or run manually:
python ingest_fast.py --validate
```

**Expected Runtime:** ~2 hours for 60 months with 2 workers

## Data Sources

This ingests two types of CSV files from CMS Nursing Home Provider data:

- **NH_QualityMsr_MDS_*.csv** - MDS-derived quality measures (18 measures per facility)
- **NH_QualityMsr_Claims_*.csv** - Claims-based quality measures (4 measures per facility)

## Schema Overview

### Staging Tables (UNLOGGED for fast writes)
- `staging.nh_quality_mds_raw` - Raw MDS data as loaded from CSV
- `staging.nh_quality_claims_raw` - Raw Claims data as loaded from CSV

### Gold Tables
- `gold.nh_quality_mds` - Cleaned MDS measures ready for analysis
- `gold.nh_quality_claims` - Cleaned Claims measures ready for analysis
- `gold.nh_quality_extracts` - Metadata about each monthly extract
- `gold.nh_measure_definitions` - Reference data for measure codes

### Natural Keys
- **MDS:** `(extract_id, ccn, measure_code)` - UNIQUE constraint
- **Claims:** `(extract_id, ccn, measure_code)` - UNIQUE constraint

## CRID Measure Codes

### MDS Measures (for CRID calculation)
| Code | Description | CRID Weight |
|------|-------------|-------------|
| 410 | Falls with major injury | 0.35 |
| 453 | Pressure ulcers (high risk) | 0.30 |
| 407 | UTI prevalence | 0.20 |
| 409 | Physical restraint use | 0.15 |

### Claims Measures (for CRID calculation)
| Code | Description | CRID Weight |
|------|-------------|-------------|
| 551 | Hospitalizations per 1000 resident days | 0.60 |
| 552 | ED visits per 1000 resident days | 0.40 |

## Command Reference

### Full Ingestion (Recommended)
```bash
python ingest_fast.py \
    --data-dir /Users/nikolashulewsky/Desktop/cms_historical_data \
    --workers 2
```

### Schema Setup
```bash
python ingest_fast.py --setup-schema
```

### Validation Only
```bash
python ingest_fast.py --validate
```

### Test with Limited Data
```bash
python ingest_fast.py \
    --data-dir /Users/nikolashulewsky/Desktop/cms_historical_data \
    --limit 3 \
    --workers 2
```

### Force Reload All Months
```bash
python ingest_fast.py \
    --data-dir /Users/nikolashulewsky/Desktop/cms_historical_data \
    --workers 2 \
    --force
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `--data-dir` | Path to cms_historical_data folder (required for ingestion) |
| `--db-url` | PostgreSQL connection URL (default: marketplace DB) |
| `--workers N` | Number of parallel workers (default: 2, max: 4) |
| `--limit N` | Process only N months (for testing) |
| `--force` | Force reload all months (ignore already-loaded) |
| `--setup-schema` | Run schema setup only |
| `--validate` | Run post-ingestion validation only |
| `--skip-unlogged` | Skip UNLOGGED optimization |

## Success Criteria

After a successful full ingestion, validation should show:

```
[1] EXTRACTS LOADED: 60
[2] TOTAL ROWS:
    MDS:       ~17,500,000
    Claims:     ~3,600,000
[3] ROWS BY EXTRACT: ~290K MDS + ~61K Claims per month
[4] DUPLICATE CHECK: No duplicates found. OK
[5] CRID MEASURES: All 6 measures present (410, 453, 407, 409, 551, 552)
[6] FACILITIES WITH COMPLETE CRID DATA: ~12,000

VALIDATION PASSED
```

## Performance Notes

### Optimizations
- **COPY INTO staging** - 10-50x faster than row-by-row INSERT
- **UNLOGGED staging tables** - No WAL overhead during bulk load
- **DELETE + INSERT pattern** - Faster than UPSERT for bulk operations
- **Parallel workers** - Each worker processes unique months independently

### Worker Safety
- Each worker uses a separate database connection (thread-local)
- Each worker processes a unique `extract_id` (no concurrent access)
- Staging data is scoped by `extract_id` - workers don't interfere
- Month queue is pre-partitioned before parallel processing

### Expected Runtimes
| Workers | ~Time for 60 months |
|---------|---------------------|
| 1 | ~4 hours |
| 2 | ~2 hours |
| 4 | ~1.2 hours |

## Idempotency

The script is idempotent and safe to re-run:

1. **Skip loaded months** - Checks `gold.nh_quality_extracts` for existing extract_ids
2. **DELETE + INSERT** - Existing data for an extract_id is deleted before new data is inserted
3. **No partial states** - Each month is processed atomically

To force reload all months, use `--force`.

## Troubleshooting

### Connection errors
```bash
# Test database connection
python -c "import psycopg2; psycopg2.connect('postgresql://...')"
```

### Validation failures
```bash
# Run validation to see details
python ingest_fast.py --validate

# Check for specific issues
psql $DATABASE_URL -f validate.sql
```

### Resume after failure
The script automatically skips already-loaded months. Just re-run:
```bash
python ingest_fast.py --data-dir /path/to/data --workers 2
```

## NH-IR-007: CRID Materialization

After ingestion, materialize CRID (Clinical Reporting Integrity Divergence) scores:

```bash
# Materialize CRID into metrics.crid_monthly
python materialize_crid.py

# Validation only (no rebuild)
python materialize_crid.py --validate

# View SQL without executing
python materialize_crid.py --dry-run
```

### CRID Formula
```
MDS_Composite = 0.35×(410) + 0.30×(453) + 0.20×(407) + 0.15×(409)
Claims_Utilization = 0.60×(551) + 0.40×(552)
CRID = z(MDS_Composite) - z(Claims_Utilization)
```

### Key Design Decisions
- **Z-scores within (state, extract_id)** - State-level peer comparison, not national
- **Exclude suppressed/missing** - Facilities without all 6 measures get NULL CRID
- **Min 10 facilities per state** - States with <10 facilities are excluded from z-score calculation

### Target Table: `metrics.crid_monthly`
| Column | Description |
|--------|-------------|
| ccn | Facility identifier |
| extract_id | YYYYMM |
| crid_value | The divergence score (positive = MDS worse than claims suggest) |
| crid_volatility | 3-month rolling std dev |
| flags | Array: HIGH_POSITIVE_CRID, HIGH_NEGATIVE_CRID, HIGH_VOLATILITY, etc. |
| measure_*_score | Individual measure scores for drill-down |
| state_* | Peer context (mean, stddev, count) |

### Expected Results (60-month load)
```
[1] SUMMARY:
    Total rows:        ~700,000
    Unique facilities: ~15,000
    Extracts:          60

[2] CRID DISTRIBUTION:
    Mean:   ~0 (by construction)
    StdDev: ~1.4 (difference of two z-scores)

[3] FLAGS:
    HIGH_POSITIVE_CRID: ~2-5% of records
    HIGH_NEGATIVE_CRID: ~2-5% of records
```

### CRID Interpretation
| CRID Value | Meaning |
|------------|---------|
| > 2.0 | MDS reports significantly worse outcomes than claims suggest |
| 1.0 to 2.0 | MDS moderately worse than claims |
| -1.0 to 1.0 | Normal divergence range |
| -2.0 to -1.0 | Claims moderately worse than MDS |
| < -2.0 | Claims significantly worse than MDS reports |

**Positive CRID (high):** Facility's self-reported quality (MDS) is worse than their utilization patterns (Claims) would predict. Could indicate honest reporting or clinical issues.

**Negative CRID (low):** Facility's utilization (hospitalizations, ED visits) is worse than their self-reported quality (MDS) would predict. Could indicate under-reporting of quality issues.
