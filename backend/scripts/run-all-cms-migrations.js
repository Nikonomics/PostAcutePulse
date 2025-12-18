/**
 * Run All CMS Migrations and Imports
 *
 * This script:
 * 1. Adds missing columns to snf_facilities (staffing, chain, etc.)
 * 2. Creates cms_extracts table (required for foreign keys)
 * 3. Creates VBP, MDS, COVID, ownership tables
 * 4. Imports data from available CMS files
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
const isRemote = connectionString.includes('render.com') || connectionString.includes('amazonaws.com');

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

// CSV parsing helper
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('STEP 1: Adding missing columns to snf_facilities');
    console.log('========================================\n');

    // Check if columns already exist
    const existingCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'snf_facilities'
    `);
    const colNames = existingCols.rows.map(r => r.column_name);

    if (!colNames.includes('lpn_staffing_hours')) {
      await client.query(`
        ALTER TABLE snf_facilities
        ADD COLUMN IF NOT EXISTS lpn_staffing_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS licensed_staffing_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS pt_staffing_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS weekend_total_nurse_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS weekend_rn_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS total_nursing_turnover NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS rn_turnover NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS admin_departures INTEGER,
        ADD COLUMN IF NOT EXISTS nursing_case_mix_index NUMERIC(6,4),
        ADD COLUMN IF NOT EXISTS nursing_case_mix_ratio NUMERIC(6,4),
        ADD COLUMN IF NOT EXISTS case_mix_cna_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS case_mix_lpn_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS case_mix_rn_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS case_mix_total_nurse_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS case_mix_weekend_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS adjusted_cna_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS adjusted_lpn_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS adjusted_rn_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS adjusted_total_nurse_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS adjusted_weekend_hours NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS chain_id VARCHAR(20),
        ADD COLUMN IF NOT EXISTS chain_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS chain_facility_count INTEGER,
        ADD COLUMN IF NOT EXISTS chain_avg_overall_rating NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS chain_avg_health_rating NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS chain_avg_staffing_rating NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS chain_avg_qm_rating NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS long_stay_qm_rating INTEGER,
        ADD COLUMN IF NOT EXISTS short_stay_qm_rating INTEGER,
        ADD COLUMN IF NOT EXISTS substantiated_complaints INTEGER,
        ADD COLUMN IF NOT EXISTS infection_control_citations INTEGER,
        ADD COLUMN IF NOT EXISTS facility_reported_incidents INTEGER,
        ADD COLUMN IF NOT EXISTS fine_count INTEGER,
        ADD COLUMN IF NOT EXISTS total_fines_amount NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS payment_denial_count INTEGER,
        ADD COLUMN IF NOT EXISTS last_health_inspection_date DATE,
        ADD COLUMN IF NOT EXISTS standard_health_deficiencies INTEGER,
        ADD COLUMN IF NOT EXISTS weighted_health_score NUMERIC(8,2),
        ADD COLUMN IF NOT EXISTS is_urban BOOLEAN,
        ADD COLUMN IF NOT EXISTS in_hospital BOOLEAN,
        ADD COLUMN IF NOT EXISTS has_resident_council BOOLEAN,
        ADD COLUMN IF NOT EXISTS has_sprinkler_system BOOLEAN,
        ADD COLUMN IF NOT EXISTS ownership_changed_12mo BOOLEAN,
        ADD COLUMN IF NOT EXISTS inspection_over_2yrs_ago BOOLEAN,
        ADD COLUMN IF NOT EXISTS cms_processing_date DATE,
        ADD COLUMN IF NOT EXISTS average_residents_per_day NUMERIC(8,2)
      `);
      console.log('✓ Added missing staffing/chain columns to snf_facilities');
    } else {
      console.log('✓ Staffing columns already exist, skipping');
    }

    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_chain_id ON snf_facilities(chain_id);
      CREATE INDEX IF NOT EXISTS idx_snf_chain_name ON snf_facilities(chain_name);
      CREATE INDEX IF NOT EXISTS idx_snf_is_urban ON snf_facilities(is_urban);
    `);
    console.log('✓ Added indexes');

    console.log('\n========================================');
    console.log('STEP 2: Creating cms_extracts table');
    console.log('========================================\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cms_extracts (
        extract_id SERIAL PRIMARY KEY,
        extract_date DATE NOT NULL UNIQUE,
        source_file VARCHAR(255),
        processing_date DATE,
        record_count INTEGER,
        import_started_at TIMESTAMP,
        import_completed_at TIMESTAMP,
        import_status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_extracts_date ON cms_extracts(extract_date);
    `);
    console.log('✓ Created cms_extracts table');

    // Insert a default extract for current data
    await client.query(`
      INSERT INTO cms_extracts (extract_date, source_file, import_status, notes)
      VALUES ('2025-11-01', 'NH_ProviderInfo_Nov2025.csv', 'completed', 'Initial import')
      ON CONFLICT (extract_date) DO NOTHING
    `);
    console.log('✓ Added default extract record');

    console.log('\n========================================');
    console.log('STEP 3: Creating VBP scores table');
    console.log('========================================\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS vbp_scores (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        fiscal_year INTEGER NOT NULL,
        ccn VARCHAR(10) NOT NULL,
        vbp_ranking INTEGER,
        baseline_readmission_rate DECIMAL(8,4),
        baseline_period VARCHAR(50),
        performance_readmission_rate DECIMAL(8,4),
        performance_period VARCHAR(50),
        achievement_score DECIMAL(8,4),
        improvement_score DECIMAL(8,4),
        performance_score DECIMAL(8,4),
        incentive_payment_multiplier DECIMAL(8,6),
        ranking_footnote VARCHAR(20),
        baseline_footnote VARCHAR(20),
        performance_footnote VARCHAR(20),
        achievement_footnote VARCHAR(20),
        improvement_footnote VARCHAR(20),
        performance_score_footnote VARCHAR(20),
        multiplier_footnote VARCHAR(20),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fiscal_year, ccn)
      );
      CREATE INDEX IF NOT EXISTS idx_vbp_ccn ON vbp_scores(ccn);
      CREATE INDEX IF NOT EXISTS idx_vbp_fy ON vbp_scores(fiscal_year);
      CREATE INDEX IF NOT EXISTS idx_vbp_ranking ON vbp_scores(vbp_ranking);
    `);
    console.log('✓ Created vbp_scores table');

    console.log('\n========================================');
    console.log('STEP 4: Creating MDS quality measures table');
    console.log('========================================\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mds_quality_measures (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        measure_code VARCHAR(20) NOT NULL,
        measure_description TEXT,
        q1_score DECIMAL(10,4),
        q2_score DECIMAL(10,4),
        q3_score DECIMAL(10,4),
        q4_score DECIMAL(10,4),
        four_quarter_score DECIMAL(10,4),
        q1_footnote VARCHAR(20),
        q2_footnote VARCHAR(20),
        q3_footnote VARCHAR(20),
        q4_footnote VARCHAR(20),
        state_average DECIMAL(10,4),
        national_average DECIMAL(10,4),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ccn, measure_code)
      );
      CREATE INDEX IF NOT EXISTS idx_mdsqm_ccn ON mds_quality_measures(ccn);
      CREATE INDEX IF NOT EXISTS idx_mdsqm_measure ON mds_quality_measures(measure_code);
    `);
    console.log('✓ Created mds_quality_measures table');

    console.log('\n========================================');
    console.log('STEP 5: Creating COVID vaccination table');
    console.log('========================================\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS covid_vaccination (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        staff_vaccination_rate DECIMAL(6,2),
        staff_up_to_date_rate DECIMAL(6,2),
        resident_vaccination_rate DECIMAL(6,2),
        resident_up_to_date_rate DECIMAL(6,2),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ccn)
      );
      CREATE INDEX IF NOT EXISTS idx_covid_ccn ON covid_vaccination(ccn);
    `);
    console.log('✓ Created covid_vaccination table');

    console.log('\n========================================');
    console.log('STEP 6: Creating ownership records table');
    console.log('========================================\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ownership_records (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        role_type VARCHAR(100),
        owner_type VARCHAR(100),
        owner_name VARCHAR(255),
        ownership_percentage DECIMAL(6,2),
        association_date DATE,
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ownership_ccn ON ownership_records(ccn);
      CREATE INDEX IF NOT EXISTS idx_ownership_name ON ownership_records(owner_name);
      CREATE INDEX IF NOT EXISTS idx_ownership_type ON ownership_records(owner_type);
    `);
    console.log('✓ Created ownership_records table');

    console.log('\n========================================');
    console.log('STEP 7: Creating penalty records table');
    console.log('========================================\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS penalty_records (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        penalty_date DATE,
        penalty_type VARCHAR(100),
        fine_amount DECIMAL(12,2),
        payment_denial_start_date DATE,
        payment_denial_days INTEGER,
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_penalty_ccn ON penalty_records(ccn);
      CREATE INDEX IF NOT EXISTS idx_penalty_date ON penalty_records(penalty_date);
    `);
    console.log('✓ Created penalty_records table');

    console.log('\n========================================');
    console.log('ALL MIGRATIONS COMPLETE');
    console.log('========================================\n');

  } finally {
    client.release();
  }
}

async function importVBPData() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('IMPORTING VBP DATA');
    console.log('========================================\n');

    // Find VBP files
    const dataDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data';
    const files = fs.readdirSync(dataDir).filter(f => f.includes('VBP') && f.includes('Facility') && f.endsWith('.csv'));

    for (const file of files) {
      const match = file.match(/FY_(\d{4})/);
      const fiscalYear = match ? parseInt(match[1]) : null;

      if (!fiscalYear) continue;

      console.log(`Importing ${file} (FY ${fiscalYear})...`);

      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      if (lines.length < 2) continue;

      const headers = parseCSVLine(lines[0]);

      // Find column indexes
      const ccnIdx = headers.findIndex(h => /CCN|CMS Certification Number|Provider ID/i.test(h));
      const rankIdx = headers.findIndex(h => /Ranking/i.test(h));
      const baselineIdx = headers.findIndex(h => /Baseline.*Rate/i.test(h));
      const perfIdx = headers.findIndex(h => /Performance.*Rate/i.test(h));
      const achIdx = headers.findIndex(h => /Achievement.*Score/i.test(h));
      const impIdx = headers.findIndex(h => /Improvement.*Score/i.test(h));
      const perfScoreIdx = headers.findIndex(h => /Performance Score/i.test(h) && !/Rate/i.test(h));
      const multiplierIdx = headers.findIndex(h => /Multiplier/i.test(h));

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (!row[ccnIdx]) continue;

        const ccn = row[ccnIdx].replace(/[^0-9A-Z]/gi, '');
        if (!ccn || ccn.length < 6) continue;

        const parseNum = (val) => {
          if (!val || val === '' || val === 'N/A') return null;
          const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
          return isNaN(num) ? null : num;
        };

        try {
          await client.query(`
            INSERT INTO vbp_scores (fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
              performance_readmission_rate, achievement_score, improvement_score,
              performance_score, incentive_payment_multiplier)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (fiscal_year, ccn) DO UPDATE SET
              vbp_ranking = EXCLUDED.vbp_ranking,
              baseline_readmission_rate = EXCLUDED.baseline_readmission_rate,
              performance_readmission_rate = EXCLUDED.performance_readmission_rate,
              achievement_score = EXCLUDED.achievement_score,
              improvement_score = EXCLUDED.improvement_score,
              performance_score = EXCLUDED.performance_score,
              incentive_payment_multiplier = EXCLUDED.incentive_payment_multiplier
          `, [
            fiscalYear,
            ccn,
            parseNum(row[rankIdx]),
            parseNum(row[baselineIdx]),
            parseNum(row[perfIdx]),
            parseNum(row[achIdx]),
            parseNum(row[impIdx]),
            parseNum(row[perfScoreIdx]),
            parseNum(row[multiplierIdx])
          ]);
          imported++;
        } catch (e) {
          // Skip individual row errors
        }
      }
      console.log(`  ✓ Imported ${imported} records for FY ${fiscalYear}`);
    }

    // Also check historical archives
    const archiveDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data';
    if (fs.existsSync(archiveDir)) {
      const yearDirs = fs.readdirSync(archiveDir).filter(d => /^\d{4}$/.test(d));
      for (const year of yearDirs) {
        const yearPath = path.join(archiveDir, year);
        try {
          const vbpFiles = fs.readdirSync(yearPath).filter(f => f.includes('VBP') && f.includes('Facility') && f.endsWith('.csv'));
          for (const file of vbpFiles) {
            const match = file.match(/FY_(\d{4})/);
            const fiscalYear = match ? parseInt(match[1]) : null;
            if (!fiscalYear) continue;

            // Check if already imported
            const existing = await client.query('SELECT COUNT(*) FROM vbp_scores WHERE fiscal_year = $1', [fiscalYear]);
            if (parseInt(existing.rows[0].count) > 0) {
              console.log(`  Skipping FY ${fiscalYear} - already imported`);
              continue;
            }

            console.log(`Importing ${file} from ${year} archive...`);
            const filePath = path.join(yearPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());

            if (lines.length < 2) continue;

            const headers = parseCSVLine(lines[0]);
            const ccnIdx = headers.findIndex(h => /CCN|CMS Certification Number|Provider ID/i.test(h));
            const rankIdx = headers.findIndex(h => /Ranking/i.test(h));
            const baselineIdx = headers.findIndex(h => /Baseline.*Rate/i.test(h));
            const perfIdx = headers.findIndex(h => /Performance.*Rate/i.test(h));
            const achIdx = headers.findIndex(h => /Achievement.*Score/i.test(h));
            const impIdx = headers.findIndex(h => /Improvement.*Score/i.test(h));
            const perfScoreIdx = headers.findIndex(h => /Performance Score/i.test(h) && !/Rate/i.test(h));
            const multiplierIdx = headers.findIndex(h => /Multiplier/i.test(h));

            let imported = 0;
            for (let i = 1; i < lines.length; i++) {
              const row = parseCSVLine(lines[i]);
              if (!row[ccnIdx]) continue;

              const ccn = row[ccnIdx].replace(/[^0-9A-Z]/gi, '');
              if (!ccn || ccn.length < 6) continue;

              const parseNum = (val) => {
                if (!val || val === '' || val === 'N/A') return null;
                const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
                return isNaN(num) ? null : num;
              };

              try {
                await client.query(`
                  INSERT INTO vbp_scores (fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
                    performance_readmission_rate, achievement_score, improvement_score,
                    performance_score, incentive_payment_multiplier)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  ON CONFLICT (fiscal_year, ccn) DO NOTHING
                `, [
                  fiscalYear,
                  ccn,
                  parseNum(row[rankIdx]),
                  parseNum(row[baselineIdx]),
                  parseNum(row[perfIdx]),
                  parseNum(row[achIdx]),
                  parseNum(row[impIdx]),
                  parseNum(row[perfScoreIdx]),
                  parseNum(row[multiplierIdx])
                ]);
                imported++;
              } catch (e) {
                // Skip
              }
            }
            console.log(`  ✓ Imported ${imported} records for FY ${fiscalYear}`);
          }
        } catch (e) {
          // Skip directories we can't read
        }
      }
    }

    const vbpCount = await client.query('SELECT COUNT(*) FROM vbp_scores');
    console.log(`\n✓ Total VBP records: ${vbpCount.rows[0].count}`);

  } finally {
    client.release();
  }
}

async function updateProviderInfo() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('UPDATING PROVIDER INFO WITH MISSING COLUMNS');
    console.log('========================================\n');

    const dataDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data';
    const providerFile = path.join(dataDir, 'NH_ProviderInfo_Nov2025.csv');

    if (!fs.existsSync(providerFile)) {
      console.log('Provider info file not found, skipping');
      return;
    }

    const content = fs.readFileSync(providerFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    // Map headers to column indexes
    const findCol = (patterns) => {
      for (const p of patterns) {
        const idx = headers.findIndex(h => p.test(h));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const cols = {
      ccn: findCol([/Federal Provider Number/i, /CCN/i]),
      lpnHrs: findCol([/LPN.*HPRD|Reported LPN/i]),
      ptHrs: findCol([/Physical Therapist.*HPRD|Reported PT/i]),
      weekendTotal: findCol([/Weekend Total.*Hours/i]),
      weekendRn: findCol([/Weekend RN.*Hours/i]),
      nursingTurnover: findCol([/Total Nursing Staff Turnover/i]),
      rnTurnover: findCol([/RN Turnover/i]),
      adminDepartures: findCol([/Administrator.*Departure/i]),
      caseMixIndex: findCol([/Case.*Mix.*Index/i]),
      longStayQm: findCol([/Long.*Stay.*QM.*Rating/i]),
      shortStayQm: findCol([/Short.*Stay.*QM.*Rating/i]),
      chainId: findCol([/Chain.*ID/i]),
      chainName: findCol([/Chain.*Name/i, /Chain Organization/i]),
      complaints: findCol([/Substantiated.*Complaint/i]),
      infections: findCol([/Infection.*Control.*Citation/i]),
      incidents: findCol([/Reported.*Incident/i]),
      fineCount: findCol([/Number.*Fine/i, /Fine.*Count/i]),
      totalFines: findCol([/Total.*Fine.*Amount/i]),
      isUrban: findCol([/Location.*Urban/i, /Urban.*Rural/i]),
      inspectionDate: findCol([/Health.*Inspection.*Date/i, /Last.*Survey.*Date/i])
    };

    console.log('Column mapping:', cols);

    let updated = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[cols.ccn]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      const parseNum = (val) => {
        if (!val || val === '' || val === 'N/A') return null;
        const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;
      };

      const parseBool = (val) => {
        if (!val) return null;
        return /yes|true|y|urban/i.test(val);
      };

      const parseDate = (val) => {
        if (!val || val === '' || val === 'N/A') return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
      };

      try {
        await client.query(`
          UPDATE snf_facilities SET
            lpn_staffing_hours = COALESCE($2, lpn_staffing_hours),
            pt_staffing_hours = COALESCE($3, pt_staffing_hours),
            weekend_total_nurse_hours = COALESCE($4, weekend_total_nurse_hours),
            weekend_rn_hours = COALESCE($5, weekend_rn_hours),
            total_nursing_turnover = COALESCE($6, total_nursing_turnover),
            rn_turnover = COALESCE($7, rn_turnover),
            admin_departures = COALESCE($8, admin_departures),
            nursing_case_mix_index = COALESCE($9, nursing_case_mix_index),
            long_stay_qm_rating = COALESCE($10, long_stay_qm_rating),
            short_stay_qm_rating = COALESCE($11, short_stay_qm_rating),
            chain_id = COALESCE($12, chain_id),
            chain_name = COALESCE($13, chain_name),
            substantiated_complaints = COALESCE($14, substantiated_complaints),
            infection_control_citations = COALESCE($15, infection_control_citations),
            facility_reported_incidents = COALESCE($16, facility_reported_incidents),
            fine_count = COALESCE($17, fine_count),
            total_fines_amount = COALESCE($18, total_fines_amount),
            is_urban = COALESCE($19, is_urban),
            last_health_inspection_date = COALESCE($20, last_health_inspection_date)
          WHERE federal_provider_number = $1
        `, [
          ccn,
          parseNum(row[cols.lpnHrs]),
          parseNum(row[cols.ptHrs]),
          parseNum(row[cols.weekendTotal]),
          parseNum(row[cols.weekendRn]),
          parseNum(row[cols.nursingTurnover]),
          parseNum(row[cols.rnTurnover]),
          parseNum(row[cols.adminDepartures]),
          parseNum(row[cols.caseMixIndex]),
          parseNum(row[cols.longStayQm]),
          parseNum(row[cols.shortStayQm]),
          row[cols.chainId] || null,
          row[cols.chainName] || null,
          parseNum(row[cols.complaints]),
          parseNum(row[cols.infections]),
          parseNum(row[cols.incidents]),
          parseNum(row[cols.fineCount]),
          parseNum(row[cols.totalFines]),
          parseBool(row[cols.isUrban]),
          parseDate(row[cols.inspectionDate])
        ]);
        updated++;
      } catch (e) {
        // Skip errors
      }

      if (updated % 1000 === 0) {
        console.log(`  Updated ${updated} facilities...`);
      }
    }

    console.log(`\n✓ Updated ${updated} facilities with additional data`);

  } finally {
    client.release();
  }
}

async function importMDSQualityMeasures() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('IMPORTING MDS QUALITY MEASURES');
    console.log('========================================\n');

    const dataDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data';
    const qrpFile = fs.readdirSync(dataDir).find(f => f.includes('Quality_Reporting_Program_Provider') && f.endsWith('.csv'));

    if (!qrpFile) {
      console.log('QRP file not found, skipping MDS import');
      return;
    }

    const filePath = path.join(dataDir, qrpFile);
    console.log(`Reading ${qrpFile}...`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    // Find CCN column
    const ccnIdx = headers.findIndex(h => /CCN|CMS Certification Number|Federal Provider/i.test(h));
    if (ccnIdx < 0) {
      console.log('CCN column not found');
      return;
    }

    // Find measure columns (usually named like "401 - Falls with Major Injury - Long Stay")
    const measureCols = headers.map((h, i) => {
      const match = h.match(/^(\d{3})\s*-\s*(.+)/);
      if (match) {
        return { idx: i, code: match[1], description: match[2].trim() };
      }
      return null;
    }).filter(Boolean);

    console.log(`Found ${measureCols.length} quality measure columns`);

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[ccnIdx]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      for (const measure of measureCols) {
        const value = row[measure.idx];
        if (!value || value === '' || value === 'N/A') continue;

        const score = parseFloat(value.replace(/[^0-9.-]/g, ''));
        if (isNaN(score)) continue;

        try {
          await client.query(`
            INSERT INTO mds_quality_measures (ccn, measure_code, measure_description, four_quarter_score)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (ccn, measure_code) DO UPDATE SET
              four_quarter_score = EXCLUDED.four_quarter_score,
              measure_description = EXCLUDED.measure_description
          `, [ccn, measure.code, measure.description, score]);
          imported++;
        } catch (e) {
          // Skip
        }
      }

      if (i % 1000 === 0) {
        console.log(`  Processed ${i} of ${lines.length} facilities...`);
      }
    }

    console.log(`\n✓ Imported ${imported} quality measure records`);

  } finally {
    client.release();
  }
}

async function main() {
  console.log('====================================');
  console.log('CMS DATA MIGRATION & IMPORT TOOL');
  console.log('====================================');

  try {
    await runMigrations();
    await importVBPData();
    await updateProviderInfo();
    await importMDSQualityMeasures();

    console.log('\n====================================');
    console.log('ALL OPERATIONS COMPLETE');
    console.log('====================================\n');

    // Run final verification
    const client = await pool.connect();
    try {
      console.log('Final data counts:');
      const tables = ['snf_facilities', 'vbp_scores', 'mds_quality_measures', 'ownership_records', 'penalty_records', 'covid_vaccination'];
      for (const table of tables) {
        try {
          const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
          console.log(`  ${table}: ${result.rows[0].count} rows`);
        } catch (e) {
          console.log(`  ${table}: error - ${e.message}`);
        }
      }
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
