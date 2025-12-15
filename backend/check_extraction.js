const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL);

// Check deal-level extraction data
sequelize.query("SELECT id, deal_name, extraction_data FROM deals WHERE id = 39;")
  .then(async ([results]) => {
    if (results.length === 0) {
      console.log('Deal 39 not found');
      process.exit(1);
    }
    
    const deal = results[0];
    const ext = typeof deal.extraction_data === 'string' ? JSON.parse(deal.extraction_data) : deal.extraction_data;
    
    console.log('=== DEAL 39: ' + deal.deal_name + ' ===\n');
    
    console.log('--- Portfolio Metadata ---');
    console.log('is_portfolio_deal:', ext.is_portfolio_deal);
    console.log('facility_count:', ext.facility_count);
    console.log('subject_count:', ext.subject_count);
    console.log('competitor_count:', ext.competitor_count);
    
    console.log('\n--- Deal Overview ---');
    if (ext.deal_overview) {
      console.log('summary_1000_chars:', ext.deal_overview.summary_1000_chars?.substring(0, 300) + '...');
      console.log('facility_snapshot:', ext.deal_overview.facility_snapshot ? 'Present' : 'Missing');
      console.log('ttm_financials:', ext.deal_overview.ttm_financials ? 'Present' : 'Missing');
      console.log('red_flags:', ext.deal_overview.red_flags?.length || 0, 'items');
      console.log('strengths:', ext.deal_overview.strengths?.length || 0, 'items');
    } else {
      console.log('deal_overview: MISSING');
    }
    
    console.log('\n--- Key Financials ---');
    console.log('annual_revenue:', ext.annual_revenue);
    console.log('net_income:', ext.net_income);
    console.log('ebitdar:', ext.ebitdar);
    console.log('occupancy:', ext.occupancy);
    console.log('bed_count:', ext.bed_count || ext.total_beds);
    
    console.log('\n--- Monthly Data ---');
    console.log('monthly_trends:', ext.monthly_trends ? `Array with ${ext.monthly_trends.length} months` : 'Missing');
    
    // Check facilities
    const [facilities] = await sequelize.query("SELECT id, facility_name, facility_role FROM deal_facilities WHERE deal_id = 39;");
    console.log('\n--- Facilities ---');
    facilities.forEach(f => console.log(`  ${f.facility_role}: ${f.facility_name}`));
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
