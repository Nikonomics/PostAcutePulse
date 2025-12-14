const Sequelize = require('sequelize');

/**
 * User Saved Items Model
 *
 * Stores bookmarked/saved items for users including:
 * - Deals
 * - Facilities (from deals or market database)
 * - Markets (state/county combinations)
 *
 * Users can add optional notes when saving items.
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('user_saved_items', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Polymorphic type discriminator: 'deal', 'facility', 'market', 'ownership_group'
    item_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['deal', 'facility', 'market', 'ownership_group']]
      }
    },
    // Deal reference (for item_type = 'deal')
    deal_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'deals',
        key: 'id'
      }
    },
    // Deal facility reference (for facilities attached to deals)
    deal_facility_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'deal_facilities',
        key: 'id'
      }
    },
    // Market facility type ('SNF' or 'ALF') for market database facilities
    market_facility_type: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    // Market facility ID (references snf_facilities or alf_facilities in market DB)
    market_facility_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Market state code (for item_type = 'market')
    market_state: {
      type: DataTypes.STRING(2),
      allowNull: true
    },
    // Market county name (for item_type = 'market')
    market_county: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // Optional CBSA code for metro area context
    market_cbsa_code: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    // Ownership group/chain name (for item_type = 'ownership_group')
    ownership_group_name: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    // User's personal note about the saved item
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'user_saved_items',
    timestamps: false,
    indexes: [
      // Index for fetching user's saved items
      { fields: ['user_id'] },
      // Index for filtering by type
      { fields: ['user_id', 'item_type'] },
      // Unique constraint: one save per user per deal
      {
        fields: ['user_id', 'deal_id'],
        unique: true,
        name: 'idx_saved_items_user_deal_unique',
        where: {
          deal_id: { [Sequelize.Op.ne]: null }
        }
      },
      // Unique constraint: one save per user per deal facility
      {
        fields: ['user_id', 'deal_facility_id'],
        unique: true,
        name: 'idx_saved_items_user_deal_facility_unique',
        where: {
          deal_facility_id: { [Sequelize.Op.ne]: null }
        }
      },
      // Unique constraint: one save per user per market facility
      {
        fields: ['user_id', 'market_facility_type', 'market_facility_id'],
        unique: true,
        name: 'idx_saved_items_user_market_facility_unique',
        where: {
          market_facility_id: { [Sequelize.Op.ne]: null }
        }
      },
      // Unique constraint: one save per user per market (state/county)
      {
        fields: ['user_id', 'market_state', 'market_county'],
        unique: true,
        name: 'idx_saved_items_user_market_unique',
        where: {
          market_state: { [Sequelize.Op.ne]: null }
        }
      },
      // Unique constraint: one save per user per ownership group
      {
        fields: ['user_id', 'ownership_group_name'],
        unique: true,
        name: 'idx_saved_items_user_ownership_unique',
        where: {
          ownership_group_name: { [Sequelize.Op.ne]: null }
        }
      }
    ]
  });
};
