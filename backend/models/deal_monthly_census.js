/**
 * Monthly Census Data for Deals
 * Stores time-series census and occupancy data
 * Each row represents one month's census performance
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_monthly_census', {
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
    // Month in YYYY-MM format (e.g., "2024-10")
    month: {
      type: DataTypes.STRING(7),
      allowNull: false
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

    // Census counts
    total_beds: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    average_daily_census: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    occupancy_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Census days by payer (for the month)
    total_census_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    medicaid_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    medicare_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    private_pay_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    other_payer_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    // Payer mix percentages (derived from days)
    medicaid_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicare_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    private_pay_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    other_payer_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Admissions/Discharges (if available)
    admissions: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    discharges: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    // Metadata
    extraction_confidence: {
      type: DataTypes.STRING(20),
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
    tableName: 'deal_monthly_census',
    timestamps: false,
    indexes: [
      {
        name: 'idx_monthly_census_deal_month',
        unique: true,
        fields: ['deal_id', 'month']
      },
      {
        name: 'idx_monthly_census_deal_id',
        fields: ['deal_id']
      }
    ]
  });
};
