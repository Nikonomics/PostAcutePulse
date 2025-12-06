/**
 * Monthly Financial Data for Deals
 * Stores time-series financial data extracted from P&L statements
 * Each row represents one month's financial performance
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_monthly_financials', {
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

    // Revenue
    total_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicaid_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicare_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    private_pay_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    other_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Revenue breakdown by type
    room_and_board_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    care_level_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ancillary_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Expenses (summary)
    total_expenses: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    operating_expenses: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Key expense categories
    depreciation: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    amortization: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    interest_expense: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    rent_expense: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    property_taxes: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    property_insurance: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Profitability
    net_income: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebit: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitdar: {
      type: DataTypes.FLOAT,
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
    tableName: 'deal_monthly_financials',
    timestamps: false,
    indexes: [
      {
        name: 'idx_monthly_financials_deal_month',
        unique: true,
        fields: ['deal_id', 'month']
      },
      {
        name: 'idx_monthly_financials_deal_id',
        fields: ['deal_id']
      }
    ]
  });
};
