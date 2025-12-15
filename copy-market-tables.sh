#!/bin/bash

# Script to copy market tables from SNF News DB to Snfalyze DB
# Run this script after setting the database URLs

echo "🚀 Starting market tables migration..."
echo ""

# Check if URLs are set
if [ -z "$NEWS_DB_URL" ] || [ -z "$MAIN_DB_URL" ]; then
    echo "❌ Error: Database URLs not set"
    echo ""
    echo "Please set the environment variables:"
    echo "  export NEWS_DB_URL='<your-snf-news-database-external-url>'"
    echo "  export MAIN_DB_URL='<your-snfalyze-database-external-url>'"
    echo ""
    exit 1
fi

echo "📊 Exporting tables from SNF News database..."
pg_dump "$NEWS_DB_URL" \
  -t snf_facilities \
  -t alf_facilities \
  -t state_demographics \
  -t county_demographics \
  --no-owner --no-acl \
  > market_tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Export successful: market_tables.sql"
    echo ""
    echo "📥 Importing tables into Snfalyze database..."

    psql "$MAIN_DB_URL" < market_tables.sql

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Import successful!"
        echo ""
        echo "🔍 Verifying data..."
        echo ""

        psql "$MAIN_DB_URL" -c "SELECT
            (SELECT COUNT(*) FROM snf_facilities) as snf_facilities,
            (SELECT COUNT(*) FROM alf_facilities) as alf_facilities,
            (SELECT COUNT(*) FROM state_demographics) as state_demographics,
            (SELECT COUNT(*) FROM county_demographics) as county_demographics;"

        echo ""
        echo "🎉 Migration complete!"
        echo ""
        echo "Cleaning up..."
        rm market_tables.sql
    else
        echo "❌ Import failed"
        exit 1
    fi
else
    echo "❌ Export failed"
    exit 1
fi
