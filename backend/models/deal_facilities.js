const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_facilities', {
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
    // Facility identification
    facility_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    facility_type: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // Location
    street_address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'USA'
    },
    zip_code: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    // Bed information - stored as JSON array
    // e.g., [{ "type": "SNF", "count": 80 }, { "type": "ALF", "count": 40 }]
    no_of_beds: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('no_of_beds');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          return rawValue;
        }
      },
      set(value) {
        if (value && typeof value === 'object') {
          this.setDataValue('no_of_beds', JSON.stringify(value));
        } else {
          this.setDataValue('no_of_beds', value);
        }
      }
    },
    total_beds: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Financial metrics - Purchase
    purchase_price: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    price_per_bed: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    // Financial metrics - T12M (Trailing 12 Months)
    annual_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    revenue_multiple: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda_multiple: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda_margin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitdar: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitdar_margin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    net_operating_income: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    // Operational metrics
    current_occupancy: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    average_daily_rate: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    average_daily_census: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    // Payer mix (percentages)
    medicare_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicaid_percentage: {
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
    // Revenue breakdown
    medicare_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicaid_revenue: {
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
    // Expense items
    total_expenses: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    operating_expenses: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    rent_lease_expense: {
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
    // Rate information - stored as JSON
    // e.g., { "private_pay": [{ "unit_type": "Private", "monthly_rate": 8500 }], "medicaid": [...] }
    rate_information: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('rate_information');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          return rawValue;
        }
      },
      set(value) {
        if (value && typeof value === 'object') {
          this.setDataValue('rate_information', JSON.stringify(value));
        } else {
          this.setDataValue('rate_information', value);
        }
      }
    },
    // Pro forma projections - stored as JSON
    // Structure: { year_1: {...}, year_2: {...}, year_3: {...} }
    pro_forma_projections: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('pro_forma_projections');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          return rawValue;
        }
      },
      set(value) {
        if (value && typeof value === 'object') {
          this.setDataValue('pro_forma_projections', JSON.stringify(value));
        } else {
          this.setDataValue('pro_forma_projections', value);
        }
      }
    },
    // AI extraction data - raw extraction results for this facility
    extraction_data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('extraction_data');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch {
          return rawValue;
        }
      },
      set(value) {
        if (value && typeof value === 'object') {
          this.setDataValue('extraction_data', JSON.stringify(value));
        } else {
          this.setDataValue('extraction_data', value);
        }
      }
    },
    // Notes and observations
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Display order for UI
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    // Timestamps
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
    tableName: 'deal_facilities',
    timestamps: false,
    indexes: [
      {
        name: 'idx_deal_facilities_deal_id',
        fields: ['deal_id']
      }
    ]
  });
};
