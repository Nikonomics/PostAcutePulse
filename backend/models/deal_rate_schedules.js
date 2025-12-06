/**
 * Rate Schedules for Deals
 * Stores rate information by payer type and care level
 * Rates can be effective for a date range
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_rate_schedules', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    deal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'deals',
        key: 'id'
      }
    },
    // Payer type: "private_pay", "medicaid", "medicare", "managed_care"
    payer_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    // For private pay: unit type (Studio, 1BR, 2BR, etc.)
    // For Medicaid: care level (Level 1, Level 2, etc.)
    rate_category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Care level add-on (for private pay with care levels)
    care_level: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    // Source document info for citation
    source_document: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    source_location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    // Rate information
    daily_rate: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    monthly_rate: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    annual_rate: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Additional fees
    care_level_addon: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    second_person_fee: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ancillary_fee: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Effective date range
    effective_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiration_date: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Is this the current rate?
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },

    // Metadata
    extraction_confidence: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    notes: {
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
    tableName: 'deal_rate_schedules',
    timestamps: false,
    indexes: [
      {
        name: 'idx_rate_schedules_deal_payer',
        fields: ['deal_id', 'payer_type']
      },
      {
        name: 'idx_rate_schedules_deal_id',
        fields: ['deal_id']
      },
      {
        name: 'idx_rate_schedules_current',
        fields: ['deal_id', 'is_current']
      }
    ]
  });
};
