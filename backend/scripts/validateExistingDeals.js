/**
 * Validate existing deals for extraction_data structure integrity
 *
 * Run with: node scripts/validateExistingDeals.js
 *
 * This script checks all deals with extraction_data and reports any
 * that have invalid nested structures (not auto-fixed, just reported)
 */

const db = require('../models');
const { validateFlatStructure } = require('../services/extractionValidator');

async function validateExistingDeals() {
  console.log('=== Extraction Data Validation Report ===\n');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    // Get all deals with extraction_data
    // Note: enhanced_extraction_data may not exist in all database schemas
    let deals;
    try {
      deals = await db.deals.findAll({
        where: {
          extraction_data: {
            [db.Sequelize.Op.ne]: null
          }
        },
        attributes: ['id', 'deal_name', 'facility_name', 'extraction_data', 'enhanced_extraction_data']
      });
    } catch (e) {
      // Fallback if enhanced_extraction_data column doesn't exist
      console.log('Note: enhanced_extraction_data column not found, checking extraction_data only\n');
      deals = await db.deals.findAll({
        where: {
          extraction_data: {
            [db.Sequelize.Op.ne]: null
          }
        },
        attributes: ['id', 'deal_name', 'facility_name', 'extraction_data']
      });
    }

    console.log(`Found ${deals.length} deals with extraction_data\n`);

    const results = {
      valid: [],
      invalid: [],
      warnings: []
    };

    for (const deal of deals) {
      const dealInfo = `Deal ${deal.id}: "${deal.deal_name || deal.facility_name || 'Unnamed'}"`;

      // Parse extraction_data
      let extractionData = null;
      try {
        extractionData = typeof deal.extraction_data === 'string'
          ? JSON.parse(deal.extraction_data)
          : deal.extraction_data;
      } catch (e) {
        results.invalid.push({
          dealId: deal.id,
          dealInfo,
          errors: [`Failed to parse extraction_data: ${e.message}`],
          warnings: []
        });
        continue;
      }

      // Validate
      const validation = validateFlatStructure(extractionData);

      if (!validation.isValid) {
        results.invalid.push({
          dealId: deal.id,
          dealInfo,
          errors: validation.errors,
          warnings: validation.warnings
        });
      } else if (validation.warnings.length > 0) {
        results.warnings.push({
          dealId: deal.id,
          dealInfo,
          warnings: validation.warnings
        });
      } else {
        results.valid.push(deal.id);
      }

      // Also check enhanced_extraction_data if present
      if (deal.enhanced_extraction_data) {
        let enhancedData = null;
        try {
          enhancedData = typeof deal.enhanced_extraction_data === 'string'
            ? JSON.parse(deal.enhanced_extraction_data)
            : deal.enhanced_extraction_data;

          // Enhanced data has extractedData sub-object
          const targetData = enhancedData.extractedData || enhancedData;
          const enhancedValidation = validateFlatStructure(targetData);

          if (!enhancedValidation.isValid) {
            const existingEntry = results.invalid.find(r => r.dealId === deal.id);
            if (existingEntry) {
              existingEntry.errors.push(...enhancedValidation.errors.map(e => `[enhanced] ${e}`));
            } else {
              results.invalid.push({
                dealId: deal.id,
                dealInfo: `${dealInfo} (enhanced_extraction_data)`,
                errors: enhancedValidation.errors,
                warnings: enhancedValidation.warnings
              });
            }
          }
        } catch (e) {
          // Ignore enhanced data parse errors for now
        }
      }
    }

    // Print results
    console.log('=== SUMMARY ===\n');
    console.log(`✅ Valid deals: ${results.valid.length}`);
    console.log(`⚠️  Deals with warnings: ${results.warnings.length}`);
    console.log(`❌ Invalid deals: ${results.invalid.length}`);

    if (results.invalid.length > 0) {
      console.log('\n=== INVALID DEALS (require attention) ===\n');
      for (const item of results.invalid) {
        console.log(`${item.dealInfo}`);
        for (const error of item.errors) {
          console.log(`  ❌ ${error}`);
        }
        if (item.warnings.length > 0) {
          for (const warning of item.warnings) {
            console.log(`  ⚠️  ${warning}`);
          }
        }
        console.log('');
      }
    }

    if (results.warnings.length > 0) {
      console.log('\n=== DEALS WITH WARNINGS ===\n');
      for (const item of results.warnings) {
        console.log(`${item.dealInfo}`);
        for (const warning of item.warnings) {
          console.log(`  ⚠️  ${warning}`);
        }
        console.log('');
      }
    }

    console.log('\n=== Validation complete ===');

    // Return exit code based on results
    if (results.invalid.length > 0) {
      console.log('\n⚠️  Some deals have invalid extraction_data structure.');
      console.log('   Review the errors above and consider running a migration to fix them.');
    }

    process.exit(results.invalid.length > 0 ? 1 : 0);

  } catch (err) {
    console.error('Validation failed:', err);
    process.exit(1);
  }
}

validateExistingDeals();
