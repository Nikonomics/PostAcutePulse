-- Reorganize database into schemas
-- Shared data stays in public schema
-- Project-specific data moves to dedicated schemas

-- Create schemas for each project
CREATE SCHEMA IF NOT EXISTS snfalyze;
CREATE SCHEMA IF NOT EXISTS snf_news;

-- Move SNF News specific tables to snf_news schema
ALTER TABLE IF EXISTS articles SET SCHEMA snf_news;
ALTER TABLE IF EXISTS article_tags SET SCHEMA snf_news;
ALTER TABLE IF EXISTS bills SET SCHEMA snf_news;
ALTER TABLE IF EXISTS bill_alerts SET SCHEMA snf_news;
ALTER TABLE IF EXISTS bill_changes SET SCHEMA snf_news;
ALTER TABLE IF EXISTS bill_keyword_matches SET SCHEMA snf_news;
ALTER TABLE IF EXISTS bill_versions SET SCHEMA snf_news;
ALTER TABLE IF EXISTS keywords SET SCHEMA snf_news;
ALTER TABLE IF EXISTS tags SET SCHEMA snf_news;
ALTER TABLE IF EXISTS conferences SET SCHEMA snf_news;
ALTER TABLE IF EXISTS state_summaries SET SCHEMA snf_news;
ALTER TABLE IF EXISTS data_refresh_log SET SCHEMA snf_news;
ALTER TABLE IF EXISTS collection_logs SET SCHEMA snf_news;
ALTER TABLE IF EXISTS user_bookmarks SET SCHEMA snf_news;
ALTER TABLE IF EXISTS user_preferences SET SCHEMA snf_news;
ALTER TABLE IF EXISTS users SET SCHEMA snf_news;

-- Shared tables remain in public schema (no changes needed):
-- - snf_facilities
-- - alf_facilities
-- - state_demographics
-- - county_demographics
-- - state_market_metrics
-- - cms_facility_deficiencies

-- Grant permissions
GRANT USAGE ON SCHEMA snfalyze TO nikolashulewsky;
GRANT USAGE ON SCHEMA snf_news TO nikolashulewsky;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA snfalyze TO nikolashulewsky;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA snf_news TO nikolashulewsky;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nikolashulewsky;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA snfalyze TO nikolashulewsky;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA snf_news TO nikolashulewsky;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nikolashulewsky;
