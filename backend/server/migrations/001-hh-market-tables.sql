-- Home Health Market Database Tables
-- Run against the market database (snf_market_data)

-- Track data imports
CREATE TABLE IF NOT EXISTS hh_extracts (
  extract_id SERIAL PRIMARY KEY,
  extract_date DATE NOT NULL UNIQUE,
  source_file VARCHAR(255),
  import_status VARCHAR(20) DEFAULT 'pending',
  record_count INTEGER,
  processing_date DATE,
  import_started_at TIMESTAMPTZ,
  import_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core provider data snapshots (point-in-time)
CREATE TABLE IF NOT EXISTS hh_provider_snapshots (
  snapshot_id SERIAL PRIMARY KEY,
  extract_id INTEGER REFERENCES hh_extracts(extract_id),
  ccn VARCHAR(6) NOT NULL,
  state CHAR(2) NOT NULL,
  provider_name VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  zip_code VARCHAR(10),
  telephone VARCHAR(20),
  ownership_type VARCHAR(50),
  certification_date DATE,

  -- Services offered
  offers_nursing BOOLEAN DEFAULT FALSE,
  offers_pt BOOLEAN DEFAULT FALSE,
  offers_ot BOOLEAN DEFAULT FALSE,
  offers_speech BOOLEAN DEFAULT FALSE,
  offers_social_work BOOLEAN DEFAULT FALSE,
  offers_aide BOOLEAN DEFAULT FALSE,

  -- Star Rating
  quality_star_rating DECIMAL(2,1),
  quality_star_footnote TEXT,

  -- OASIS Measures - Timely Initiation
  timely_initiation_num INTEGER,
  timely_initiation_denom INTEGER,
  timely_initiation_pct DECIMAL(5,2),
  timely_initiation_fn TEXT,

  -- OASIS Measures - Flu Shot
  flu_shot_num INTEGER,
  flu_shot_denom INTEGER,
  flu_shot_pct DECIMAL(5,2),
  flu_shot_fn TEXT,

  -- OASIS Measures - Walking/Ambulation
  walking_improvement_num INTEGER,
  walking_improvement_denom INTEGER,
  walking_improvement_pct DECIMAL(5,2),
  walking_improvement_fn TEXT,

  -- OASIS Measures - Bed Transfer
  bed_transfer_num INTEGER,
  bed_transfer_denom INTEGER,
  bed_transfer_pct DECIMAL(5,2),
  bed_transfer_fn TEXT,

  -- OASIS Measures - Bathing
  bathing_improvement_num INTEGER,
  bathing_improvement_denom INTEGER,
  bathing_improvement_pct DECIMAL(5,2),
  bathing_improvement_fn TEXT,

  -- OASIS Measures - Breathing
  breathing_improvement_num INTEGER,
  breathing_improvement_denom INTEGER,
  breathing_improvement_pct DECIMAL(5,2),
  breathing_improvement_fn TEXT,

  -- OASIS Measures - Medication Compliance
  medication_compliance_num INTEGER,
  medication_compliance_denom INTEGER,
  medication_compliance_pct DECIMAL(5,2),
  medication_compliance_fn TEXT,

  -- OASIS Measures - Pressure Ulcer
  pressure_ulcer_num INTEGER,
  pressure_ulcer_denom INTEGER,
  pressure_ulcer_pct DECIMAL(5,2),
  pressure_ulcer_fn TEXT,

  -- OASIS Measures - Medication Actions
  medication_actions_num INTEGER,
  medication_actions_denom INTEGER,
  medication_actions_pct DECIMAL(5,2),
  medication_actions_fn TEXT,

  -- OASIS Measures - Falls with Injury
  falls_injury_num INTEGER,
  falls_injury_denom INTEGER,
  falls_injury_pct DECIMAL(5,2),
  falls_injury_fn TEXT,

  -- OASIS Measures - Discharge Function
  discharge_function_num INTEGER,
  discharge_function_denom INTEGER,
  discharge_function_score DECIMAL(8,2),
  discharge_function_fn TEXT,

  -- OASIS Measures - Health Info Transfer
  health_info_provider_num INTEGER,
  health_info_provider_denom INTEGER,
  health_info_provider_pct DECIMAL(5,2),
  health_info_provider_fn TEXT,

  health_info_patient_num INTEGER,
  health_info_patient_denom INTEGER,
  health_info_patient_pct DECIMAL(5,2),
  health_info_patient_fn TEXT,

  -- Claims-Based: Discharged to Community (DTC)
  dtc_num INTEGER,
  dtc_denom INTEGER,
  dtc_observed_rate DECIMAL(5,2),
  dtc_risk_std_rate DECIMAL(5,2),
  dtc_risk_std_lower DECIMAL(5,2),
  dtc_risk_std_upper DECIMAL(5,2),
  dtc_performance_category VARCHAR(50),
  dtc_fn TEXT,

  -- Claims-Based: Potentially Preventable Readmissions (PPR)
  ppr_num INTEGER,
  ppr_denom INTEGER,
  ppr_observed_rate DECIMAL(5,2),
  ppr_risk_std_rate DECIMAL(5,2),
  ppr_risk_std_lower DECIMAL(5,2),
  ppr_risk_std_upper DECIMAL(5,2),
  ppr_performance_category VARCHAR(50),
  ppr_fn TEXT,

  -- Claims-Based: Potentially Preventable Hospitalizations (PPH)
  pph_num INTEGER,
  pph_denom INTEGER,
  pph_observed_rate DECIMAL(5,2),
  pph_risk_std_rate DECIMAL(5,2),
  pph_risk_std_lower DECIMAL(5,2),
  pph_risk_std_upper DECIMAL(5,2),
  pph_performance_category VARCHAR(50),
  pph_fn TEXT,

  -- Medicare spending
  medicare_spending_ratio DECIMAL(4,2),
  medicare_spending_fn TEXT,
  episode_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extract_id, ccn)
);

-- HHCAHPS patient satisfaction snapshots
CREATE TABLE IF NOT EXISTS hh_cahps_snapshots (
  snapshot_id SERIAL PRIMARY KEY,
  extract_id INTEGER REFERENCES hh_extracts(extract_id),
  ccn VARCHAR(6) NOT NULL,

  summary_star_rating DECIMAL(2,1),
  summary_star_fn TEXT,

  care_of_patients_star DECIMAL(2,1),
  care_of_patients_pct DECIMAL(5,2),
  care_of_patients_fn TEXT,

  communication_star DECIMAL(2,1),
  communication_pct DECIMAL(5,2),
  communication_fn TEXT,

  specific_care_star DECIMAL(2,1),
  specific_care_pct DECIMAL(5,2),
  specific_care_fn TEXT,

  overall_rating_star DECIMAL(2,1),
  overall_rating_pct DECIMAL(5,2),
  overall_rating_fn TEXT,

  recommend_agency_pct DECIMAL(5,2),
  recommend_agency_fn TEXT,

  survey_response_count INTEGER,
  survey_response_rate DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extract_id, ccn)
);

-- HHVBP scores (annual)
CREATE TABLE IF NOT EXISTS hh_vbp_scores (
  score_id SERIAL PRIMARY KEY,
  ccn VARCHAR(6) NOT NULL,
  state CHAR(2),
  provider_name VARCHAR(255),
  performance_year INTEGER NOT NULL,

  -- Total Performance Score
  total_performance_score DECIMAL(8,4),
  payment_adjustment_pct DECIMAL(6,3),

  -- Component Scores
  oasis_score DECIMAL(8,4),
  claims_score DECIMAL(8,4),
  cahps_score DECIMAL(8,4),

  -- Baseline/Performance Period info
  baseline_year_start INTEGER,
  baseline_year_end INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ccn, performance_year)
);

-- State benchmarks
CREATE TABLE IF NOT EXISTS hh_state_benchmarks (
  benchmark_id SERIAL PRIMARY KEY,
  extract_id INTEGER REFERENCES hh_extracts(extract_id),
  state CHAR(2) NOT NULL,

  quality_star_avg DECIMAL(3,2),
  star_1_pct DECIMAL(5,2),
  star_1_5_pct DECIMAL(5,2),
  star_2_pct DECIMAL(5,2),
  star_2_5_pct DECIMAL(5,2),
  star_3_pct DECIMAL(5,2),
  star_3_5_pct DECIMAL(5,2),
  star_4_pct DECIMAL(5,2),
  star_4_5_pct DECIMAL(5,2),
  star_5_pct DECIMAL(5,2),

  timely_initiation_pct DECIMAL(5,2),
  flu_shot_pct DECIMAL(5,2),
  walking_improvement_pct DECIMAL(5,2),
  bed_transfer_pct DECIMAL(5,2),
  bathing_improvement_pct DECIMAL(5,2),
  breathing_improvement_pct DECIMAL(5,2),
  medication_compliance_pct DECIMAL(5,2),
  pressure_ulcer_pct DECIMAL(5,2),
  medication_actions_pct DECIMAL(5,2),
  falls_injury_pct DECIMAL(5,2),
  health_info_provider_pct DECIMAL(5,2),
  health_info_patient_pct DECIMAL(5,2),

  dtc_rate DECIMAL(5,2),
  ppr_rate DECIMAL(5,2),
  pph_rate DECIMAL(5,2),
  medicare_spending_ratio DECIMAL(4,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extract_id, state)
);

-- National benchmarks
CREATE TABLE IF NOT EXISTS hh_national_benchmarks (
  benchmark_id SERIAL PRIMARY KEY,
  extract_id INTEGER REFERENCES hh_extracts(extract_id),

  quality_star_avg DECIMAL(3,2),
  star_1_pct DECIMAL(5,2),
  star_1_5_pct DECIMAL(5,2),
  star_2_pct DECIMAL(5,2),
  star_2_5_pct DECIMAL(5,2),
  star_3_pct DECIMAL(5,2),
  star_3_5_pct DECIMAL(5,2),
  star_4_pct DECIMAL(5,2),
  star_4_5_pct DECIMAL(5,2),
  star_5_pct DECIMAL(5,2),

  timely_initiation_pct DECIMAL(5,2),
  flu_shot_pct DECIMAL(5,2),
  walking_improvement_pct DECIMAL(5,2),
  bed_transfer_pct DECIMAL(5,2),
  bathing_improvement_pct DECIMAL(5,2),
  breathing_improvement_pct DECIMAL(5,2),
  medication_compliance_pct DECIMAL(5,2),
  pressure_ulcer_pct DECIMAL(5,2),
  medication_actions_pct DECIMAL(5,2),
  falls_injury_pct DECIMAL(5,2),
  health_info_provider_pct DECIMAL(5,2),
  health_info_patient_pct DECIMAL(5,2),

  -- Claims-based national metrics
  ppr_better_count INTEGER,
  ppr_same_count INTEGER,
  ppr_worse_count INTEGER,
  ppr_too_few_count INTEGER,
  ppr_national_rate DECIMAL(5,2),

  dtc_better_count INTEGER,
  dtc_same_count INTEGER,
  dtc_worse_count INTEGER,
  dtc_too_few_count INTEGER,
  dtc_national_rate DECIMAL(5,2),

  pph_better_count INTEGER,
  pph_same_count INTEGER,
  pph_worse_count INTEGER,
  pph_too_few_count INTEGER,
  pph_national_rate DECIMAL(5,2),

  medicare_spending_ratio DECIMAL(4,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extract_id)
);

-- Event tracking for changes
CREATE TABLE IF NOT EXISTS hh_provider_events (
  event_id SERIAL PRIMARY KEY,
  ccn VARCHAR(6) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_date DATE NOT NULL,
  previous_extract_id INTEGER REFERENCES hh_extracts(extract_id),
  current_extract_id INTEGER REFERENCES hh_extracts(extract_id),
  previous_value TEXT,
  new_value TEXT,
  change_magnitude DECIMAL(5,2),
  state CHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service area ZIP codes
CREATE TABLE IF NOT EXISTS hh_service_areas (
  id SERIAL PRIMARY KEY,
  extract_id INTEGER REFERENCES hh_extracts(extract_id),
  ccn VARCHAR(6) NOT NULL,
  zip_code VARCHAR(5) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extract_id, ccn, zip_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hh_provider_snapshots_ccn ON hh_provider_snapshots(ccn);
CREATE INDEX IF NOT EXISTS idx_hh_provider_snapshots_state ON hh_provider_snapshots(state);
CREATE INDEX IF NOT EXISTS idx_hh_provider_snapshots_extract ON hh_provider_snapshots(extract_id);
CREATE INDEX IF NOT EXISTS idx_hh_provider_snapshots_rating ON hh_provider_snapshots(quality_star_rating);
CREATE INDEX IF NOT EXISTS idx_hh_cahps_snapshots_ccn ON hh_cahps_snapshots(ccn);
CREATE INDEX IF NOT EXISTS idx_hh_cahps_snapshots_extract ON hh_cahps_snapshots(extract_id);
CREATE INDEX IF NOT EXISTS idx_hh_vbp_scores_ccn ON hh_vbp_scores(ccn);
CREATE INDEX IF NOT EXISTS idx_hh_vbp_scores_year ON hh_vbp_scores(performance_year);
CREATE INDEX IF NOT EXISTS idx_hh_provider_events_ccn ON hh_provider_events(ccn);
CREATE INDEX IF NOT EXISTS idx_hh_provider_events_date ON hh_provider_events(event_date);
CREATE INDEX IF NOT EXISTS idx_hh_provider_events_type ON hh_provider_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hh_service_areas_ccn ON hh_service_areas(ccn);
CREATE INDEX IF NOT EXISTS idx_hh_service_areas_zip ON hh_service_areas(zip_code);
