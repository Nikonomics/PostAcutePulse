-- Move SNF News specific views from public to snf_news schema
-- These views reference snf_news schema tables and belong in that schema

-- Drop views from public schema
DROP VIEW IF EXISTS public.active_state_bills;
DROP VIEW IF EXISTS public.recent_federal_bills;
DROP VIEW IF EXISTS public.recent_high_impact;
DROP VIEW IF EXISTS public.urgent_bills;
DROP VIEW IF EXISTS public.upcoming_conferences;

-- Recreate in snf_news schema

-- Active state bills
CREATE VIEW snf_news.active_state_bills AS
SELECT
  bills.id,
  bills.bill_number,
  bills.external_id,
  bills.title,
  bills.summary,
  bills.full_text,
  bills.source,
  bills.jurisdiction,
  bills.state,
  bills.document_type,
  bills.status,
  bills.sponsor,
  bills.committee,
  bills.introduced_date,
  bills.last_action_date,
  bills.url,
  bills.api_url,
  bills.pdf_url,
  bills.ai_relevance_score,
  bills.ai_impact_type,
  bills.ai_explanation,
  bills.ai_summary,
  bills.financial_impact_pbpy,
  bills.annual_facility_impact,
  bills.reimbursement_risk,
  bills.staffing_risk,
  bills.compliance_risk,
  bills.quality_risk,
  bills.operational_area,
  bills.implementation_timeline,
  bills.implementation_steps,
  bills.has_comment_period,
  bills.comment_deadline,
  bills.comment_url,
  bills.effective_date,
  bills.priority,
  bills.passage_likelihood,
  bills.tracking_enabled,
  bills.topics,
  bills.snf_keywords_matched,
  bills.created_at,
  bills.updated_at,
  bills.analyzed_at,
  bills.last_checked_at,
  bills.analysis
FROM snf_news.bills
WHERE bills.jurisdiction = 'state'
  AND bills.status NOT IN ('dead', 'vetoed', 'withdrawn')
  AND bills.tracking_enabled = true
ORDER BY bills.state, bills.last_action_date DESC;

-- Recent federal bills
CREATE VIEW snf_news.recent_federal_bills AS
SELECT
  bills.id,
  bills.bill_number,
  bills.external_id,
  bills.title,
  bills.summary,
  bills.full_text,
  bills.source,
  bills.jurisdiction,
  bills.state,
  bills.document_type,
  bills.status,
  bills.sponsor,
  bills.committee,
  bills.introduced_date,
  bills.last_action_date,
  bills.url,
  bills.api_url,
  bills.pdf_url,
  bills.ai_relevance_score,
  bills.ai_impact_type,
  bills.ai_explanation,
  bills.ai_summary,
  bills.financial_impact_pbpy,
  bills.annual_facility_impact,
  bills.reimbursement_risk,
  bills.staffing_risk,
  bills.compliance_risk,
  bills.quality_risk,
  bills.operational_area,
  bills.implementation_timeline,
  bills.implementation_steps,
  bills.has_comment_period,
  bills.comment_deadline,
  bills.comment_url,
  bills.effective_date,
  bills.priority,
  bills.passage_likelihood,
  bills.tracking_enabled,
  bills.topics,
  bills.snf_keywords_matched,
  bills.created_at,
  bills.updated_at,
  bills.analyzed_at,
  bills.last_checked_at,
  bills.analysis
FROM snf_news.bills
WHERE bills.jurisdiction = 'federal'
  AND bills.introduced_date > CURRENT_DATE - INTERVAL '90 days'
ORDER BY bills.introduced_date DESC;

-- Recent high impact articles
CREATE VIEW snf_news.recent_high_impact AS
SELECT
  articles.id,
  articles.title,
  articles.summary,
  articles.url,
  articles.source,
  articles.published_date,
  articles.category,
  articles.impact,
  articles.scope,
  articles.states
FROM snf_news.articles
WHERE articles.impact = 'high'
  AND articles.published_date > CURRENT_DATE - INTERVAL '30 days'
ORDER BY articles.published_date DESC;

-- Urgent bills
CREATE VIEW snf_news.urgent_bills AS
SELECT
  bills.id,
  bills.bill_number,
  bills.title,
  bills.source,
  bills.jurisdiction,
  bills.state,
  bills.ai_relevance_score,
  bills.priority,
  bills.comment_deadline,
  bills.effective_date,
  bills.status,
  bills.last_action_date
FROM snf_news.bills
WHERE (
  bills.priority IN ('urgent', 'high')
  OR (
    bills.has_comment_period = true
    AND bills.comment_deadline >= CURRENT_DATE
    AND bills.comment_deadline <= CURRENT_DATE + INTERVAL '30 days'
  )
)
AND bills.tracking_enabled = true
ORDER BY
  CASE bills.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  bills.comment_deadline,
  bills.last_action_date DESC;

-- Upcoming conferences
CREATE VIEW snf_news.upcoming_conferences AS
SELECT
  conferences.id,
  conferences.organization,
  conferences.event_name,
  conferences.date_start,
  conferences.date_end,
  conferences.location,
  conferences.state,
  conferences.city,
  conferences.venue,
  conferences.website,
  conferences.status,
  conferences.category,
  conferences.created_at,
  conferences.updated_at
FROM snf_news.conferences
WHERE conferences.date_start >= CURRENT_DATE
  AND conferences.status = 'confirmed'
ORDER BY conferences.date_start;
