# Facility Metrics Tab - Design Specification

## Overview
A comprehensive facility analysis interface with 5 sub-tabs:
1. Snapshot - At-a-glance health check
2. Trends - Historical performance over time
3. Benchmarks - Comparison to peer groups
4. Risk Analysis - Composite risk scoring
5. Reports - Exportable report builder

## Global Components

### Facility Selector (appears on all tabs)
- Search input with autocomplete
- Filters: Chain, State, Rating
- Display: Facility name, city, state, beds, ownership type
- Comparison toggle: State Avg | National | Chain Avg | Custom Group

### Standard Card Component
- White background, 8px border radius
- 16px padding
- Subtle shadow
- Consistent header style: icon + title + subtitle/description

### Color Coding
- Green (#22c55e): Good/positive/above average
- Yellow (#eab308): Watch/moderate/near average
- Red (#ef4444): Problem/negative/below average
- Purple (#8b5cf6): Neutral data points
- Arrows: ▲ (green, improving), ▼ (red, declining), ━ (gray, stable)

## Data Structure

### Facility Object (from CMS data we have)
```javascript
{
  // Identification
  provider_id: string,
  facility_name: string,
  address: string,
  city: string,
  state: string,
  county: string,
  zip: string,

  // Characteristics
  certified_beds: number,
  residents_total: number,
  ownership_type: 'For-Profit' | 'Non-Profit' | 'Government',
  chain_id: string,
  chain_name: string,
  in_hospital: boolean,

  // Star Ratings (current)
  overall_rating: 1-5,
  quality_rating: 1-5,
  staffing_rating: 1-5,
  health_inspection_rating: 1-5,

  // Staffing (from PBJ)
  total_nursing_hprd: number,
  rn_hprd: number,
  lpn_hprd: number,
  cna_hprd: number,
  rn_turnover_rate: number,
  total_turnover_rate: number,
  administrator_days_in_role: number,
  weekend_staffing_ratio: number,

  // Census
  occupancy_rate: number,

  // Compliance
  total_deficiencies: number,
  health_deficiencies: number,
  fire_safety_deficiencies: number,
  total_penalties_amount: number,
  sff_status: boolean,

  // Clinical
  case_mix_index: number,

  // Payer Mix
  medicare_pct: number,
  medicaid_pct: number,
  private_pay_pct: number,

  // VBP
  vbp_performance_score: number,
  vbp_adjustment: number,

  // Historical (arrays for trending)
  rating_history: Array<{date, overall, quality, staffing, inspection}>,
  staffing_history: Array<{date, total_hprd, rn_hprd, lpn_hprd, cna_hprd}>,
  occupancy_history: Array<{date, rate}>,
  deficiency_history: Array<{date, count, type}>,
  penalty_history: Array<{date, amount, type}>,
  turnover_history: Array<{date, rn_rate, total_rate}>
}
```

### Derived Metrics (calculated client-side or via API)
```javascript
{
  // Composite Scores (0-100)
  overall_health_score: number,
  regulatory_risk_score: number,
  staffing_risk_score: number,
  financial_risk_score: number,

  // Trajectory (-1 to +1, or category)
  quality_trajectory: 'improving' | 'stable' | 'declining',
  staffing_trajectory: 'improving' | 'stable' | 'declining',

  // Percentiles (vs selected comparison group)
  overall_rating_percentile: number,
  staffing_percentile: number,
  occupancy_percentile: number,

  // Comparisons
  vs_state_avg: { [metric]: delta },
  vs_national_avg: { [metric]: delta },
  vs_chain_avg: { [metric]: delta },

  // Financial Proxies
  payer_mix_quality_score: number,
  vbp_dollar_impact: number,

  // Risk Components
  survey_overdue_days: number,
  penalty_recency_days: number
}
```

## Tab Specifications

### Tab 1: Snapshot
[Details to be added per phase]

### Tab 2: Trends
[Details to be added per phase]

### Tab 3: Benchmarks
[Details to be added per phase]

### Tab 4: Risk Analysis
[Details to be added per phase]

### Tab 5: Reports
[Details to be added per phase]
