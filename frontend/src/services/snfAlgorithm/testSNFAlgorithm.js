/**
 * Test file for SNF Algorithm with the provided deal data
 */

import { SNFDealEvaluator } from './snfEvaluator.js';

// Test data from the provided JSON
const testDealData = {
  "id": 56,
  "user_id": 17,
  "position": 2,
  "deal_name": "SuperSonic",
  "deal_type": "Acquisition",
  "priority_level": "High",
  "deal_source": "Next Healthcare",
  "primary_contact_name": "Shimmy Sussman",
  "title": "CFO",
  "phone_number": "3474071908",
  "email": "SS@Nexthcc.com",
  "target_close_date": "2025-12-01T00:00:00.000Z",
  "dd_period_weeks": "",
  "deal_lead_id": 1,
  "assistant_deal_lead_id": 1,
  "deal_status": "due_diligence",
  "email_notification_major_updates": "yes",
  "document_upload_notification": "yes",
  "total_deal_amount": 62000000,
  "created_at": "2025-08-28T21:55:46.000Z",
  "updated_at": null,
  "deal_lead": {
    "id": 1,
    "first_name": "Super",
    "last_name": "Admin",
    "profile_url": null
  },
  "assistant_deal_lead": {
    "id": 1,
    "first_name": "Super",
    "last_name": "Admin",
    "profile_url": null
  },
  "deal_facility": [
    {
      "id": 447,
      "deal_id": 56,
      "facility_name": "Renton Health and Rehab",
      "facility_type": "Skilled Nursing",
      "no_of_beds": [
        {
          "type": "Skilled Nursing",
          "count": 99
        }
      ],
      "purchase_price": 0,
      "price_per_bed": 0,
      "address": "80 Southwest 2nd Street, Renton, WA, USA",
      "city": "Renton",
      "state": "WA",
      "longitude": -122.22,
      "latitude": 47.4826,
      "t12m_revenue": 0,
      "t12m_occupancy": 0,
      "t12m_ebitdar": 0,
      "current_rent_lease_expense": 0,
      "t12m_ebitda": 0,
      "t12m_ebit": 0,
      "proforma_year1_annual_revenue": 0,
      "proforma_year1_annual_ebitdar": 0,
      "proforma_year1_annual_rent": 0,
      "proforma_year1_annual_ebitda": 0,
      "proforma_year1_average_occupancy": 0,
      "proforma_year1_annual_ebit": 0,
      "proforma_year2_annual_revenue": 0,
      "proforma_year2_annual_ebitdar": 0,
      "proforma_year2_annual_rent": 0,
      "proforma_year2_annual_ebitda": 0,
      "proforma_year2_average_occupancy": 0,
      "proforma_year2_annual_ebit": 0,
      "proforma_year3_annual_revenue": 0,
      "proforma_year3_annual_ebitdar": 0,
      "proforma_year3_annual_rent": 0,
      "proforma_year3_annual_ebitda": 0,
      "proforma_year3_average_occupancy": 0,
      "proforma_year3_annual_ebit": 0,
      "created_at": "2025-08-31T17:58:22.000Z",
      "updated_at": null
    },
    {
      "id": 448,
      "deal_id": 56,
      "facility_name": "Valley View Skilled Nursing \"Talbot\"",
      "facility_type": "Skilled Nursing",
      "no_of_beds": [
        {
          "type": "Skilled Nursing",
          "count": 136
        }
      ],
      "purchase_price": 0,
      "price_per_bed": 0,
      "address": "4430 Talbot Rd S, Renton, WA, USA",
      "city": "Renton",
      "state": "WA",
      "longitude": -122.212,
      "latitude": 47.4396,
      "t12m_revenue": 0,
      "t12m_occupancy": 0,
      "t12m_ebitdar": 0,
      "current_rent_lease_expense": 0,
      "t12m_ebitda": 0,
      "t12m_ebit": 0,
      "proforma_year1_annual_revenue": 0,
      "proforma_year1_annual_ebitdar": 0,
      "proforma_year1_annual_rent": 0,
      "proforma_year1_annual_ebitda": 0,
      "proforma_year1_average_occupancy": 0,
      "proforma_year1_annual_ebit": 0,
      "proforma_year2_annual_revenue": 0,
      "proforma_year2_annual_ebitdar": 0,
      "proforma_year2_annual_rent": 0,
      "proforma_year2_annual_ebitda": 0,
      "proforma_year2_average_occupancy": 0,
      "proforma_year2_annual_ebit": 0,
      "proforma_year3_annual_revenue": 0,
      "proforma_year3_annual_ebitdar": 0,
      "proforma_year3_annual_rent": 0,
      "proforma_year3_annual_ebitda": 0,
      "proforma_year3_average_occupancy": 0,
      "proforma_year3_annual_ebit": 0,
      "created_at": "2025-08-31T17:58:22.000Z",
      "updated_at": null
    }
  ]
};

// Test with realistic data (since the provided data has mostly zeros)
const testDealDataWithValues = {
  ...testDealData,
  deal_facility: testDealData.deal_facility.map((facility, index) => ({
    ...facility,
    purchase_price: index === 0 ? 25000000 : 37000000, // $25M and $37M
    price_per_bed: index === 0 ? 252525 : 272059, // ~$252k and $272k per bed
    t12m_revenue: index === 0 ? 8000000 : 12000000, // $8M and $12M revenue
    t12m_occupancy: 0.75, // 75% occupancy
    t12m_ebitdar: index === 0 ? 1800000 : 2700000, // $1.8M and $2.7M EBITDAR
    t12m_ebitda: index === 0 ? 720000 : 1080000, // $720k and $1.08M EBITDA
    t12m_ebit: index === 0 ? 500000 : 750000, // $500k and $750k EBIT
    current_rent_lease_expense: index === 0 ? 1000000 : 1500000, // $1M and $1.5M rent
    // Proforma Year 1
    proforma_year1_annual_revenue: index === 0 ? 9000000 : 13500000,
    proforma_year1_annual_ebitdar: index === 0 ? 2000000 : 3000000,
    proforma_year1_annual_rent: index === 0 ? 1000000 : 1500000,
    proforma_year1_annual_ebitda: index === 0 ? 1000000 : 1500000,
    proforma_year1_average_occupancy: 0.80,
    proforma_year1_annual_ebit: index === 0 ? 800000 : 1200000,
    // Proforma Year 2
    proforma_year2_annual_revenue: index === 0 ? 9500000 : 14250000,
    proforma_year2_annual_ebitdar: index === 0 ? 2100000 : 3150000,
    proforma_year2_annual_rent: index === 0 ? 1000000 : 1500000,
    proforma_year2_annual_ebitda: index === 0 ? 1100000 : 1650000,
    proforma_year2_average_occupancy: 0.82,
    proforma_year2_annual_ebit: index === 0 ? 900000 : 1350000,
    // Proforma Year 3
    proforma_year3_annual_revenue: index === 0 ? 10000000 : 15000000,
    proforma_year3_annual_ebitdar: index === 0 ? 2200000 : 3300000,
    proforma_year3_annual_rent: index === 0 ? 1000000 : 1500000,
    proforma_year3_annual_ebitda: index === 0 ? 1200000 : 1800000,
    proforma_year3_average_occupancy: 0.85,
    proforma_year3_annual_ebit: index === 0 ? 1000000 : 1500000
  }))
};

// Test function
export const testSNFAlgorithm = async () => {
  try {
    console.log('🧪 Testing SNF Algorithm with provided deal data...');
    
    // Test with realistic data
    const evaluation = await SNFDealEvaluator.evaluateDeal(testDealDataWithValues);
    
    console.log('✅ SNF Algorithm Test Results:');
    console.log('=====================================');
    console.log(`Deal Name: ${evaluation.dealName}`);
    console.log(`Investment Recommendation: ${evaluation.summary.investmentRecommendation}`);
    console.log(`Deal Score: ${evaluation.summary.dealScore}/100`);
    console.log(`Risk Level: ${evaluation.riskAssessment.overallRisk}`);
    console.log(`REIT Compatible: ${evaluation.reitCompatibility.meetsPublicREITRequirements ? 'Yes' : 'No'}`);
    console.log('');
    console.log('Key Metrics:');
    console.log(`- Total Investment: $${evaluation.overallMetrics.totalPurchasePrice?.toLocaleString()}`);
    console.log(`- Total Beds: ${evaluation.overallMetrics.totalBeds}`);
    console.log(`- Weighted Average Cap Rate: ${(evaluation.overallMetrics.weightedAverageCapRate * 100)?.toFixed(2)}%`);
    console.log(`- Average Occupancy: ${(evaluation.overallMetrics.weightedAverageOccupancy * 100)?.toFixed(1)}%`);
    console.log('');
    console.log('Facility Analysis:');
    evaluation.facilities.forEach(facility => {
      console.log(`- ${facility.facilityName}: ${(facility.capRate * 100)?.toFixed(2)}% cap rate, ${(facility.t12mOccupancy * 100)?.toFixed(1)}% occupancy`);
    });
    console.log('');
    console.log('Recommendations:');
    evaluation.recommendations.forEach(rec => {
      console.log(`- ${rec.title} (${rec.priority}): ${rec.description}`);
    });
    
    return evaluation;
  } catch (error) {
    console.error('❌ SNF Algorithm Test Failed:', error);
    throw error;
  }
};

// Export test data for use in other components
export { testDealData, testDealDataWithValues };

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - can be called from console
  window.testSNFAlgorithm = testSNFAlgorithm;
  console.log('🧪 SNF Algorithm test function available as window.testSNFAlgorithm()');
}
