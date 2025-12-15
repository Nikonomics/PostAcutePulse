#!/usr/bin/env node
/**
 * Seed CMS data definitions for UI tooltips
 *
 * Usage: node scripts/seed-cms-definitions.js
 *
 * This populates the cms_data_definitions table with human-readable
 * descriptions of all CMS nursing home data fields.
 */

const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFINITIONS = [
  // ============ STAR RATINGS ============
  {
    field_name: 'overall_rating',
    display_name: 'Overall Rating',
    short_description: 'CMS 5-star rating combining health inspections, staffing, and quality measures',
    full_description: 'The Overall Rating is a composite score from 1-5 stars based on three components: Health Inspection Rating (most heavily weighted), Staffing Rating, and Quality Measure Rating. A 5-star rating means the facility is among the best, while 1-star means much below average.',
    category: 'Ratings',
    subcategory: 'Star Ratings',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'stars',
    min_value: 1,
    max_value: 5,
    better_direction: 'higher',
    update_frequency: 'Monthly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'health_inspection_rating',
    display_name: 'Health Inspection Rating',
    short_description: 'Rating based on the number, scope, and severity of deficiencies found during inspections',
    full_description: 'Based on the 3 most recent health inspections and investigations of complaints. Accounts for the number of health deficiencies, their severity, and whether the facility has a pattern of problems. This is the most heavily weighted component of the overall rating.',
    category: 'Ratings',
    subcategory: 'Star Ratings',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'stars',
    min_value: 1,
    max_value: 5,
    better_direction: 'higher',
    update_frequency: 'Monthly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'staffing_rating',
    display_name: 'Staffing Rating',
    short_description: 'Rating based on nurse staffing hours per resident per day',
    full_description: 'Based on case-mix adjusted staffing hours for RNs and total nursing staff. Compares facility staffing to thresholds. Facilities with very low RN staffing (below 0.55 hours per resident day) or total staffing (below 3.48 hours) receive 1 star regardless of other factors.',
    category: 'Ratings',
    subcategory: 'Star Ratings',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'stars',
    min_value: 1,
    max_value: 5,
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'quality_measure_rating',
    display_name: 'Quality Measure Rating',
    short_description: 'Rating based on clinical outcomes for short-stay and long-stay residents',
    full_description: 'Based on 15 quality measures covering falls, pressure ulcers, use of antipsychotics, rehospitalizations, and other clinical outcomes. Combines measures for both short-stay (post-acute) and long-stay (chronic care) residents.',
    category: 'Ratings',
    subcategory: 'Star Ratings',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'stars',
    min_value: 1,
    max_value: 5,
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },

  // ============ STAFFING METRICS ============
  {
    field_name: 'rn_staffing_hours',
    display_name: 'RN Hours per Resident Day',
    short_description: 'Average hours of registered nurse care per resident per day',
    full_description: 'Total RN (Registered Nurse) hours worked divided by total resident census. RNs provide the highest level of nursing care and are required for certain clinical assessments. CMS recommends a minimum of 0.75 RN hours per resident day.',
    category: 'Staffing',
    subcategory: 'Reported Hours',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'National average is approximately 0.68 hours. Higher is generally better for quality of care.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'lpn_staffing_hours',
    display_name: 'LPN Hours per Resident Day',
    short_description: 'Average hours of licensed practical nurse care per resident per day',
    full_description: 'Total LPN (Licensed Practical Nurse) hours worked divided by total resident census. LPNs work under RN supervision and provide direct patient care including medication administration and wound care.',
    category: 'Staffing',
    subcategory: 'Reported Hours',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'National average is approximately 0.87 hours.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'reported_cna_staffing_hours',
    display_name: 'CNA Hours per Resident Day',
    short_description: 'Average hours of certified nursing assistant care per resident per day',
    full_description: 'Total CNA (Certified Nursing Assistant) hours worked divided by total resident census. CNAs provide the majority of direct care including bathing, dressing, feeding, and mobility assistance.',
    category: 'Staffing',
    subcategory: 'Reported Hours',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'National average is approximately 2.35 hours. CNAs provide the majority of hands-on care.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'total_nurse_staffing_hours',
    display_name: 'Total Nurse Staffing Hours',
    short_description: 'Combined RN, LPN, and CNA hours per resident per day',
    full_description: 'Sum of all nursing staff hours (RN + LPN + CNA) divided by resident census. This is a key measure of overall staffing intensity. CMS suggests a minimum of 3.48 total nursing hours per resident day.',
    category: 'Staffing',
    subcategory: 'Reported Hours',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'National average is approximately 3.90 hours. Facilities below 3.48 hours receive lowest staffing rating.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'pt_staffing_hours',
    display_name: 'Physical Therapist Hours',
    short_description: 'Average hours of physical therapy per resident per day',
    full_description: 'Total physical therapist hours worked divided by resident census. Physical therapists help residents maintain or improve mobility, strength, and balance.',
    category: 'Staffing',
    subcategory: 'Reported Hours',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'National average is approximately 0.07 hours.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'weekend_total_nurse_hours',
    display_name: 'Weekend Nurse Staffing',
    short_description: 'Total nursing hours per resident on weekends',
    full_description: 'Staffing levels specifically on Saturdays and Sundays. Weekend staffing is often lower than weekday staffing, which can affect care quality.',
    category: 'Staffing',
    subcategory: 'Reported Hours',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'Compare to weekday staffing to assess consistency.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },

  // ============ TURNOVER ============
  {
    field_name: 'total_nursing_turnover',
    display_name: 'Total Nursing Staff Turnover',
    short_description: 'Percentage of nursing staff who left employment in the past year',
    full_description: 'Annual turnover rate for all nursing staff (RNs, LPNs, CNAs). High turnover can indicate workplace issues and negatively impacts continuity of care and quality outcomes.',
    category: 'Staffing',
    subcategory: 'Turnover',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'percent',
    min_value: 0,
    max_value: 100,
    interpretation_notes: 'National average is approximately 46%. Lower turnover is associated with better quality outcomes.',
    better_direction: 'lower',
    update_frequency: 'Annual',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'rn_turnover',
    display_name: 'RN Turnover Rate',
    short_description: 'Percentage of registered nurses who left employment in the past year',
    full_description: 'Annual turnover rate specifically for registered nurses. RN turnover is particularly impactful as RNs provide clinical leadership and are harder to replace.',
    category: 'Staffing',
    subcategory: 'Turnover',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'percent',
    min_value: 0,
    max_value: 100,
    interpretation_notes: 'National average is approximately 44%. High RN turnover is a red flag for facility stability.',
    better_direction: 'lower',
    update_frequency: 'Annual',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'admin_departures',
    display_name: 'Administrator Departures',
    short_description: 'Number of administrators who left in the past year',
    full_description: 'Count of nursing home administrators who departed the facility. Frequent administrator turnover can indicate instability in facility leadership and management.',
    category: 'Staffing',
    subcategory: 'Turnover',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'count',
    min_value: 0,
    interpretation_notes: 'Zero or one is typical. Multiple departures may indicate problems.',
    better_direction: 'lower',
    update_frequency: 'Annual',
    cms_source: 'NH_ProviderInfo'
  },

  // ============ CASE-MIX ADJUSTED ============
  {
    field_name: 'nursing_case_mix_index',
    display_name: 'Nursing Case-Mix Index',
    short_description: 'Measure of resident acuity/complexity relative to national average',
    full_description: 'A score indicating how clinically complex the facility\'s residents are compared to the national average. A value of 1.0 means average acuity; higher values indicate more complex residents requiring more care.',
    category: 'Staffing',
    subcategory: 'Case-Mix',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'index',
    interpretation_notes: 'Values typically range from 0.8 to 1.5. Higher case-mix justifies higher staffing.',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'case_mix_total_nurse_hours',
    display_name: 'Case-Mix Adjusted Total Nurse Hours',
    short_description: 'Staffing hours adjusted for resident acuity',
    full_description: 'Total nursing hours divided by the case-mix index, providing a fair comparison between facilities with different resident populations. This is the measure used for the staffing star rating.',
    category: 'Staffing',
    subcategory: 'Case-Mix',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'hours/resident/day',
    min_value: 0,
    interpretation_notes: 'This is a better comparison metric than raw hours when facilities have different acuity levels.',
    better_direction: 'higher',
    update_frequency: 'Quarterly',
    cms_source: 'NH_ProviderInfo'
  },

  // ============ CHAIN DATA ============
  {
    field_name: 'chain_name',
    display_name: 'Chain/Organization Name',
    short_description: 'Name of the parent organization or chain that owns/operates this facility',
    full_description: 'The corporate entity that owns or manages the facility. Chain-affiliated facilities may share resources, policies, and management practices. Blank if the facility is independently owned.',
    category: 'Ownership',
    subcategory: 'Chain',
    source_table: 'snf_facilities',
    data_type: 'text',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'chain_facility_count',
    display_name: 'Facilities in Chain',
    short_description: 'Total number of nursing homes in the same chain',
    full_description: 'Count of all nursing facilities owned or operated by the same parent organization nationwide.',
    category: 'Ownership',
    subcategory: 'Chain',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'facilities',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'chain_avg_overall_rating',
    display_name: 'Chain Average Rating',
    short_description: 'Average overall star rating across all facilities in the chain',
    full_description: 'The mean overall star rating for all facilities operated by this chain. Useful for understanding the typical quality level of the parent organization.',
    category: 'Ownership',
    subcategory: 'Chain',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'stars',
    min_value: 1,
    max_value: 5,
    better_direction: 'higher',
    cms_source: 'NH_ProviderInfo'
  },

  // ============ DEFICIENCIES ============
  {
    field_name: 'health_deficiencies',
    display_name: 'Health Deficiencies',
    short_description: 'Number of health-related violations found in recent inspections',
    full_description: 'Total count of health deficiencies cited during the most recent standard survey. Deficiencies range from minor (isolated, no harm) to severe (immediate jeopardy to resident health or safety).',
    category: 'Quality',
    subcategory: 'Deficiencies',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'deficiencies',
    min_value: 0,
    interpretation_notes: 'National average is about 8-10 deficiencies. Zero deficiencies is rare.',
    better_direction: 'lower',
    update_frequency: 'After each inspection',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'substantiated_complaints',
    display_name: 'Substantiated Complaints',
    short_description: 'Number of verified complaints in the past 3 years',
    full_description: 'Count of complaints filed against the facility that were investigated and found to be valid. Complaints may come from residents, families, staff, or ombudsmen.',
    category: 'Quality',
    subcategory: 'Complaints',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'complaints',
    min_value: 0,
    interpretation_notes: 'Any substantiated complaints warrant review of the specific issues.',
    better_direction: 'lower',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'infection_control_citations',
    display_name: 'Infection Control Citations',
    short_description: 'Number of infection control deficiencies cited',
    full_description: 'Deficiencies specifically related to infection prevention and control practices. Particularly important given the vulnerability of nursing home residents to infectious diseases.',
    category: 'Quality',
    subcategory: 'Deficiencies',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'citations',
    min_value: 0,
    better_direction: 'lower',
    cms_source: 'NH_ProviderInfo'
  },

  // ============ VBP ============
  {
    field_name: 'vbp_ranking',
    display_name: 'VBP National Ranking',
    short_description: 'Facility ranking in the SNF Value-Based Purchasing Program',
    full_description: 'National ranking among all SNFs participating in the Value-Based Purchasing program. Based on performance score combining readmission rates, infection rates, staffing, and other measures.',
    category: 'VBP',
    subcategory: 'Performance',
    source_table: 'snf_vbp_performance',
    data_type: 'integer',
    unit: 'rank',
    min_value: 1,
    better_direction: 'lower',
    update_frequency: 'Annual (fiscal year)',
    cms_source: 'SNF_VBP_Facility_Performance'
  },
  {
    field_name: 'performance_score',
    display_name: 'VBP Performance Score',
    short_description: 'Overall score determining Medicare payment adjustment',
    full_description: 'Composite score from 0-100 based on achievement and improvement in readmission rates, healthcare-associated infections, staff turnover, and staffing hours. Determines the incentive payment multiplier.',
    category: 'VBP',
    subcategory: 'Performance',
    source_table: 'snf_vbp_performance',
    data_type: 'numeric',
    unit: 'points',
    min_value: 0,
    max_value: 100,
    better_direction: 'higher',
    update_frequency: 'Annual',
    cms_source: 'SNF_VBP_Facility_Performance'
  },
  {
    field_name: 'incentive_payment_multiplier',
    display_name: 'Medicare Payment Adjustment',
    short_description: 'Multiplier applied to Medicare payments based on VBP performance',
    full_description: 'A value greater than 1.0 means the facility receives bonus payments; less than 1.0 means a payment reduction. Top performers can earn up to +2.78% bonus, while lowest performers face up to -2% reduction.',
    category: 'VBP',
    subcategory: 'Financial',
    source_table: 'snf_vbp_performance',
    data_type: 'numeric',
    unit: 'multiplier',
    interpretation_notes: '1.0278 = +2.78% bonus, 0.98 = -2% penalty',
    better_direction: 'higher',
    update_frequency: 'Annual',
    cms_source: 'SNF_VBP_Facility_Performance'
  },
  {
    field_name: 'performance_readmission_rate',
    display_name: 'Readmission Rate',
    short_description: 'Risk-adjusted rate of hospital readmissions within 30 days of SNF discharge',
    full_description: 'Percentage of Medicare beneficiaries who were readmitted to the hospital within 30 days of discharge from the SNF. Risk-standardized to account for patient health status.',
    category: 'VBP',
    subcategory: 'Quality Measures',
    source_table: 'snf_vbp_performance',
    data_type: 'numeric',
    unit: 'rate',
    interpretation_notes: 'Lower rates indicate better care transitions and post-acute care quality.',
    better_direction: 'lower',
    update_frequency: 'Annual',
    cms_source: 'SNF_VBP_Facility_Performance'
  },

  // ============ QUALITY MEASURES ============
  {
    field_name: 'qm_ls_falls_major_injury',
    measure_code: '410',
    display_name: 'Falls with Major Injury (Long-Stay)',
    short_description: 'Percentage of long-stay residents who fell and were seriously injured',
    full_description: 'Percentage of long-stay residents who experienced one or more falls resulting in major injury (fracture, joint dislocation, head injury, or subdural hematoma).',
    category: 'Quality Measures',
    subcategory: 'Long-Stay',
    source_table: 'cms_state_benchmarks',
    data_type: 'numeric',
    unit: 'percent',
    better_direction: 'lower',
    update_frequency: 'Quarterly (rolling year)',
    cms_source: 'NH_StateUSAverages'
  },
  {
    field_name: 'qm_ls_pressure_ulcers',
    measure_code: '479',
    display_name: 'Pressure Ulcers (Long-Stay)',
    short_description: 'Percentage of long-stay residents with pressure ulcers',
    full_description: 'Percentage of long-stay residents with Stage II-IV pressure ulcers or unstageable pressure ulcers. Pressure ulcers indicate potential issues with positioning, nutrition, or skin care.',
    category: 'Quality Measures',
    subcategory: 'Long-Stay',
    source_table: 'cms_state_benchmarks',
    data_type: 'numeric',
    unit: 'percent',
    better_direction: 'lower',
    update_frequency: 'Quarterly',
    cms_source: 'NH_StateUSAverages'
  },
  {
    field_name: 'qm_ls_antipsychotic',
    measure_code: '419',
    display_name: 'Antipsychotic Medication Use (Long-Stay)',
    short_description: 'Percentage of long-stay residents receiving antipsychotic medications',
    full_description: 'Percentage of long-stay residents who received antipsychotic medications, excluding those with diagnoses for which such medications are indicated (schizophrenia, Tourette syndrome, Huntington disease).',
    category: 'Quality Measures',
    subcategory: 'Long-Stay',
    source_table: 'cms_state_benchmarks',
    data_type: 'numeric',
    unit: 'percent',
    interpretation_notes: 'Antipsychotics are sometimes inappropriately used for behavioral control. Lower is generally better.',
    better_direction: 'lower',
    update_frequency: 'Quarterly',
    cms_source: 'NH_StateUSAverages'
  },
  {
    field_name: 'qm_ss_rehospitalized',
    measure_code: '521',
    display_name: 'Rehospitalization Rate (Short-Stay)',
    short_description: 'Percentage of short-stay residents rehospitalized after admission',
    full_description: 'Percentage of short-stay residents who were rehospitalized after being admitted to the nursing home from a hospital. High rates may indicate inadequate post-acute care.',
    category: 'Quality Measures',
    subcategory: 'Short-Stay',
    source_table: 'cms_state_benchmarks',
    data_type: 'numeric',
    unit: 'percent',
    better_direction: 'lower',
    update_frequency: 'Quarterly',
    cms_source: 'NH_StateUSAverages'
  },

  // ============ FACILITY INFO ============
  {
    field_name: 'certified_beds',
    display_name: 'Certified Beds',
    short_description: 'Number of beds certified for Medicare/Medicaid',
    full_description: 'Total number of beds that are certified by CMS to provide care to Medicare and Medicaid beneficiaries.',
    category: 'Facility',
    subcategory: 'Capacity',
    source_table: 'snf_facilities',
    data_type: 'integer',
    unit: 'beds',
    cms_source: 'NH_ProviderInfo'
  },
  {
    field_name: 'occupancy_rate',
    display_name: 'Occupancy Rate',
    short_description: 'Percentage of beds currently occupied',
    full_description: 'Average daily census divided by certified bed count. Indicates how full the facility operates. Very high occupancy may strain resources; very low may indicate financial or quality issues.',
    category: 'Facility',
    subcategory: 'Census',
    source_table: 'snf_facilities',
    data_type: 'numeric',
    unit: 'percent',
    min_value: 0,
    max_value: 100,
    interpretation_notes: 'Healthy occupancy is typically 85-95%.',
    cms_source: 'Calculated from NH_ProviderInfo'
  },
  {
    field_name: 'special_focus_facility',
    display_name: 'Special Focus Facility',
    short_description: 'Facility identified by CMS as having serious quality issues',
    full_description: 'CMS identifies nursing homes with a history of serious quality issues as Special Focus Facilities (SFFs). These facilities receive more frequent inspections and must show improvement or face enforcement actions.',
    category: 'Facility',
    subcategory: 'Status',
    source_table: 'snf_facilities',
    data_type: 'boolean',
    interpretation_notes: 'TRUE indicates significant quality concerns requiring attention.',
    cms_source: 'NH_ProviderInfo'
  }
];

async function seedDefinitions() {
  console.log('\n=== Seeding CMS Data Definitions ===\n');

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    let inserted = 0;
    let updated = 0;

    for (const def of DEFINITIONS) {
      const [existing] = await sequelize.query(
        `SELECT id FROM cms_data_definitions WHERE field_name = :field_name`,
        { replacements: { field_name: def.field_name }, type: sequelize.QueryTypes.SELECT }
      );

      def.updated_at = new Date();
      def.last_updated = new Date();

      if (existing) {
        const setClauses = Object.keys(def)
          .filter(k => k !== 'field_name')
          .map(k => `${k} = :${k}`)
          .join(', ');

        await sequelize.query(
          `UPDATE cms_data_definitions SET ${setClauses} WHERE field_name = :field_name`,
          { replacements: def }
        );
        updated++;
      } else {
        def.created_at = new Date();
        const columns = Object.keys(def).join(', ');
        const placeholders = Object.keys(def).map(k => `:${k}`).join(', ');

        await sequelize.query(
          `INSERT INTO cms_data_definitions (${columns}) VALUES (${placeholders})`,
          { replacements: def }
        );
        inserted++;
      }
    }

    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Total definitions: ${DEFINITIONS.length}`);

    // Show categories
    const [cats] = await sequelize.query(`
      SELECT category, COUNT(*) as count
      FROM cms_data_definitions
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('\nDefinitions by category:');
    cats.forEach(c => console.log(`  ${c.category}: ${c.count}`));

    await sequelize.close();

  } catch (error) {
    console.error('Seed failed:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

seedDefinitions();
