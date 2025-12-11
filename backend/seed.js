/**
 * SNFalyze Database Seed Script
 * Creates sample data for local exploration
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./models');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...\n');

    // Sync database (creates tables)
    await db.sequelize.sync({ force: true });
    console.log('✅ Database tables created\n');

    // Create Users
    console.log('👥 Creating users...');
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = await db.users.bulkCreate([
      {
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@snfalyze.com',
        password: passwordHash,
        role: 'admin',
        status: 'active',
        phone_number: '555-0100',
        department: 'Administration'
      },
      {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah@snfalyze.com',
        password: passwordHash,
        role: 'deal_manager',
        status: 'active',
        phone_number: '555-0101',
        department: 'Acquisitions'
      },
      {
        first_name: 'Michael',
        last_name: 'Chen',
        email: 'michael@snfalyze.com',
        password: passwordHash,
        role: 'analyst',
        status: 'active',
        phone_number: '555-0102',
        department: 'Finance'
      },
      {
        first_name: 'Emily',
        last_name: 'Rodriguez',
        email: 'emily@snfalyze.com',
        password: passwordHash,
        role: 'reviewer',
        status: 'active',
        phone_number: '555-0103',
        department: 'Operations'
      },
      {
        first_name: 'David',
        last_name: 'Williams',
        email: 'david@snfalyze.com',
        password: passwordHash,
        role: 'analyst',
        status: 'active',
        phone_number: '555-0104',
        department: 'Finance'
      }
    ]);
    console.log(`   Created ${users.length} users`);

    // Create Master Deals
    console.log('📁 Creating master deals...');
    const masterDeals = await db.master_deals.bulkCreate([
      {
        unique_id: 'MD-2024-001',
        user_id: 2,
        street_address: '1200 Healthcare Blvd',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        zip_code: '98101'
      },
      {
        unique_id: 'MD-2024-002',
        user_id: 2,
        street_address: '4500 Medical Center Dr',
        city: 'Portland',
        state: 'OR',
        country: 'USA',
        zip_code: '97201'
      },
      {
        unique_id: 'MD-2024-003',
        user_id: 3,
        street_address: '789 Senior Living Way',
        city: 'Boise',
        state: 'ID',
        country: 'USA',
        zip_code: '83702'
      }
    ]);
    console.log(`   Created ${masterDeals.length} master deals`);

    // Create Deals
    console.log('💼 Creating deals...');
    const deals = await db.deals.bulkCreate([
      // Deal 1 - Pipeline
      {
        master_deal_id: 1,
        user_id: 2,
        deal_name: 'Evergreen Senior Care Center',
        deal_type: 'Acquisition',
        deal_status: 'pipeline',
        priority_level: 'high',
        deal_source: 'Broker',
        facility_name: 'Evergreen Senior Care',
        facility_type: 'SNF',
        bed_count: 120,
        street_address: '1200 Healthcare Blvd',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        zip_code: '98101',
        primary_contact_name: 'John Smith',
        title: 'Owner',
        phone_number: '206-555-0100',
        email: 'john@evergreencare.com',
        purchase_price: 15000000,
        annual_revenue: 8500000,
        price_per_bed: 125000,
        ebitda: 1200000,
        ebitda_margin: 14.1,
        current_occupancy: 87,
        medicare_percentage: 35,
        private_pay_percentage: 25,
        target_close_date: '2025-03-15',
        dd_period_weeks: 8,
        deal_lead_id: 2,
        assistant_deal_lead_id: 3,
        email_notification_major_updates: 'yes',
        document_upload_notification: 'yes'
      },
      // Deal 2 - Due Diligence
      {
        master_deal_id: 1,
        user_id: 2,
        deal_name: 'Pacific Northwest Rehab',
        deal_type: 'Acquisition',
        deal_status: 'due_diligence',
        priority_level: 'high',
        deal_source: 'Direct',
        facility_name: 'Pacific NW Rehabilitation',
        facility_type: 'SNF',
        bed_count: 85,
        street_address: '1250 Healthcare Blvd',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        zip_code: '98101',
        primary_contact_name: 'Mary Johnson',
        title: 'Administrator',
        phone_number: '206-555-0101',
        email: 'mary@pacificnwrehab.com',
        purchase_price: 9500000,
        annual_revenue: 5200000,
        price_per_bed: 111765,
        ebitda: 780000,
        ebitda_margin: 15.0,
        current_occupancy: 92,
        medicare_percentage: 42,
        private_pay_percentage: 20,
        target_close_date: '2025-02-01',
        dd_period_weeks: 6,
        deal_lead_id: 2,
        assistant_deal_lead_id: 4,
        email_notification_major_updates: 'yes',
        document_upload_notification: 'yes'
      },
      // Deal 3 - Pipeline
      {
        master_deal_id: 2,
        user_id: 2,
        deal_name: 'Rose City Memory Care',
        deal_type: 'Acquisition',
        deal_status: 'pipeline',
        priority_level: 'medium',
        deal_source: 'Referral',
        facility_name: 'Rose City Memory Care',
        facility_type: 'Memory Care',
        bed_count: 64,
        street_address: '4500 Medical Center Dr',
        city: 'Portland',
        state: 'OR',
        country: 'USA',
        zip_code: '97201',
        primary_contact_name: 'Robert Davis',
        title: 'Owner',
        phone_number: '503-555-0200',
        email: 'robert@rosecitymc.com',
        purchase_price: 7200000,
        annual_revenue: 4100000,
        price_per_bed: 112500,
        ebitda: 615000,
        ebitda_margin: 15.0,
        current_occupancy: 94,
        medicare_percentage: 15,
        private_pay_percentage: 55,
        target_close_date: '2025-04-30',
        dd_period_weeks: 6,
        deal_lead_id: 3,
        assistant_deal_lead_id: 5,
        email_notification_major_updates: 'yes',
        document_upload_notification: 'no'
      },
      // Deal 4 - Final Review
      {
        master_deal_id: 2,
        user_id: 3,
        deal_name: 'Columbia Valley SNF',
        deal_type: 'Acquisition',
        deal_status: 'final_review',
        priority_level: 'high',
        deal_source: 'Broker',
        facility_name: 'Columbia Valley Skilled Nursing',
        facility_type: 'SNF',
        bed_count: 150,
        street_address: '4550 Medical Center Dr',
        city: 'Portland',
        state: 'OR',
        country: 'USA',
        zip_code: '97201',
        primary_contact_name: 'Susan Lee',
        title: 'CEO',
        phone_number: '503-555-0201',
        email: 'susan@columbiavalleysnf.com',
        purchase_price: 22000000,
        annual_revenue: 12000000,
        price_per_bed: 146667,
        ebitda: 1680000,
        ebitda_margin: 14.0,
        current_occupancy: 89,
        medicare_percentage: 38,
        private_pay_percentage: 22,
        target_close_date: '2025-01-15',
        dd_period_weeks: 10,
        deal_lead_id: 2,
        assistant_deal_lead_id: 3,
        email_notification_major_updates: 'yes',
        document_upload_notification: 'yes'
      },
      // Deal 5 - Closed
      {
        master_deal_id: 3,
        user_id: 3,
        deal_name: 'Mountain View Care Home',
        deal_type: 'Acquisition',
        deal_status: 'closed',
        priority_level: 'medium',
        deal_source: 'Direct',
        facility_name: 'Mountain View Care',
        facility_type: 'Assisted Living',
        bed_count: 48,
        street_address: '789 Senior Living Way',
        city: 'Boise',
        state: 'ID',
        country: 'USA',
        zip_code: '83702',
        primary_contact_name: 'Tom Wilson',
        title: 'Owner',
        phone_number: '208-555-0300',
        email: 'tom@mountainviewcare.com',
        purchase_price: 5500000,
        annual_revenue: 3200000,
        price_per_bed: 114583,
        ebitda: 480000,
        ebitda_margin: 15.0,
        current_occupancy: 96,
        medicare_percentage: 10,
        private_pay_percentage: 70,
        target_close_date: '2024-11-01',
        dd_period_weeks: 6,
        deal_lead_id: 3,
        assistant_deal_lead_id: 4,
        email_notification_major_updates: 'yes',
        document_upload_notification: 'yes'
      },
      // Deal 6 - Pipeline (low priority)
      {
        master_deal_id: 3,
        user_id: 4,
        deal_name: 'Treasure Valley Nursing',
        deal_type: 'Acquisition',
        deal_status: 'pipeline',
        priority_level: 'low',
        deal_source: 'Cold Call',
        facility_name: 'Treasure Valley Nursing Center',
        facility_type: 'SNF',
        bed_count: 72,
        street_address: '800 Senior Living Way',
        city: 'Boise',
        state: 'ID',
        country: 'USA',
        zip_code: '83702',
        primary_contact_name: 'Linda Brown',
        title: 'Administrator',
        phone_number: '208-555-0301',
        email: 'linda@treasurevalleync.com',
        purchase_price: 6800000,
        annual_revenue: 3900000,
        price_per_bed: 94444,
        ebitda: 546000,
        ebitda_margin: 14.0,
        current_occupancy: 82,
        medicare_percentage: 40,
        private_pay_percentage: 18,
        target_close_date: '2025-06-30',
        dd_period_weeks: 8,
        deal_lead_id: 4,
        assistant_deal_lead_id: 5,
        email_notification_major_updates: 'no',
        document_upload_notification: 'no'
      }
    ]);
    console.log(`   Created ${deals.length} deals`);

    // Create Deal Team Members
    console.log('👨‍👩‍👧‍👦 Creating team assignments...');
    const teamMembers = await db.deal_team_members.bulkCreate([
      { deal_id: 1, user_id: 3 },
      { deal_id: 1, user_id: 4 },
      { deal_id: 2, user_id: 3 },
      { deal_id: 2, user_id: 5 },
      { deal_id: 3, user_id: 4 },
      { deal_id: 4, user_id: 3 },
      { deal_id: 4, user_id: 4 },
      { deal_id: 4, user_id: 5 },
      { deal_id: 5, user_id: 5 },
      { deal_id: 6, user_id: 3 }
    ]);
    console.log(`   Created ${teamMembers.length} team assignments`);

    // Create Deal Comments
    console.log('💬 Creating comments...');
    const comments = await db.deal_comments.bulkCreate([
      {
        deal_id: 1,
        user_id: 2,
        comment: 'Initial review looks promising. EBITDA margin is within our target range.',
        parent_id: null
      },
      {
        deal_id: 1,
        user_id: 3,
        comment: 'Agreed. I\'ve started the financial analysis. Should have preliminary numbers by Friday.',
        parent_id: 1
      },
      {
        deal_id: 1,
        user_id: 4,
        comment: 'Occupancy is solid at 87%. Let\'s verify the Medicare mix during DD.',
        parent_id: null
      },
      {
        deal_id: 2,
        user_id: 2,
        comment: 'DD is progressing well. No major red flags so far.',
        parent_id: null
      },
      {
        deal_id: 2,
        user_id: 4,
        comment: 'Survey history is clean. Last deficiency-free survey was 6 months ago.',
        parent_id: 4
      },
      {
        deal_id: 4,
        user_id: 2,
        comment: 'Ready for final review. All DD items completed. Recommending we proceed to close.',
        parent_id: null
      },
      {
        deal_id: 4,
        user_id: 3,
        comment: 'Financial projections attached. IRR looks good at 18.5%.',
        parent_id: 6
      },
      {
        deal_id: 4,
        user_id: 1,
        comment: 'Approved. Please prepare closing documents.',
        parent_id: 6
      }
    ]);
    console.log(`   Created ${comments.length} comments`);

    // Create Recent Activities
    console.log('📊 Creating activity log...');
    const activities = await db.recent_activities.bulkCreate([
      {
        to_id: 1,
        from_id: 2,
        subject_type: 'deal',
        subject_id: 1,
        action: 'new_deal_created',
        message: 'A new deal <strong>Evergreen Senior Care Center</strong> has been created by <strong>Sarah Johnson</strong>.',
        data: JSON.stringify({ deal_id: 1, deal_name: 'Evergreen Senior Care Center' }),
        is_team: false
      },
      {
        to_id: 3,
        from_id: 2,
        subject_type: 'deal',
        subject_id: 1,
        action: 'added_to_deal',
        message: 'You\'ve been added to the deal <strong>Evergreen Senior Care Center</strong>.',
        data: JSON.stringify({ deal_id: 1, deal_name: 'Evergreen Senior Care Center' }),
        is_team: true
      },
      {
        to_id: 2,
        from_id: 3,
        subject_type: 'deal_comment',
        subject_id: 2,
        action: 'mentioned_in_comment',
        message: '<strong>Michael Chen</strong> commented on deal <strong>Evergreen Senior Care Center</strong>.',
        data: JSON.stringify({ deal_id: 1, comment_id: 2 }),
        is_team: true
      },
      {
        to_id: 1,
        from_id: 2,
        subject_type: 'deal',
        subject_id: 4,
        action: 'deal_updated',
        message: 'Deal <strong>Columbia Valley SNF</strong> has been moved to <strong>Final Review</strong>.',
        data: JSON.stringify({ deal_id: 4, deal_name: 'Columbia Valley SNF' }),
        is_team: false
      }
    ]);
    console.log(`   Created ${activities.length} activity records`);

    // Create States reference data
    console.log('🗺️  Creating states reference...');
    const states = await db.states.bulkCreate([
      { name: 'Washington', code: 'WA', country_id: 1, status: 1 },
      { name: 'Oregon', code: 'OR', country_id: 1, status: 1 },
      { name: 'Idaho', code: 'ID', country_id: 1, status: 1 },
      { name: 'California', code: 'CA', country_id: 1, status: 1 },
      { name: 'Montana', code: 'MT', country_id: 1, status: 1 },
      { name: 'Alaska', code: 'AK', country_id: 1, status: 1 }
    ]);
    console.log(`   Created ${states.length} states`);

    console.log('\n✨ Database seeded successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST ACCOUNTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:        admin@snfalyze.com / password123');
    console.log('Deal Manager: sarah@snfalyze.com / password123');
    console.log('Analyst:      michael@snfalyze.com / password123');
    console.log('Reviewer:     emily@snfalyze.com / password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seedDatabase();
