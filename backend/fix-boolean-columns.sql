-- Fix boolean columns that were incorrectly migrated as INTEGER
-- SQLite stores TINYINT(1) as INTEGER 0/1, but PostgreSQL needs proper BOOLEAN

-- users table
ALTER TABLE snfalyze.users
  ALTER COLUMN email_notifications TYPE BOOLEAN USING (email_notifications::int = 1),
  ALTER COLUMN send_welcome_email TYPE BOOLEAN USING (send_welcome_email::int = 1);

-- recent_activities table
ALTER TABLE snfalyze.recent_activities
  ALTER COLUMN is_team DROP DEFAULT;
ALTER TABLE snfalyze.recent_activities
  ALTER COLUMN is_team TYPE BOOLEAN USING (is_team::int = 1);
ALTER TABLE snfalyze.recent_activities
  ALTER COLUMN is_team SET DEFAULT false;

-- user_notifications table
ALTER TABLE snfalyze.user_notifications
  ALTER COLUMN is_read DROP DEFAULT;
ALTER TABLE snfalyze.user_notifications
  ALTER COLUMN is_read TYPE BOOLEAN USING (is_read::int = 1);
ALTER TABLE snfalyze.user_notifications
  ALTER COLUMN is_read SET DEFAULT false;

-- deal_rate_schedules table
ALTER TABLE snfalyze.deal_rate_schedules
  ALTER COLUMN is_current DROP DEFAULT;
ALTER TABLE snfalyze.deal_rate_schedules
  ALTER COLUMN is_current TYPE BOOLEAN USING (is_current::int = 1);
ALTER TABLE snfalyze.deal_rate_schedules
  ALTER COLUMN is_current SET DEFAULT true;

-- benchmark_configurations table
ALTER TABLE snfalyze.benchmark_configurations
  ALTER COLUMN is_default DROP DEFAULT;
ALTER TABLE snfalyze.benchmark_configurations
  ALTER COLUMN is_default TYPE BOOLEAN USING (is_default::int = 1);
ALTER TABLE snfalyze.benchmark_configurations
  ALTER COLUMN is_default SET DEFAULT false;
