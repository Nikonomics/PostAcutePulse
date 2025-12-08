/**
 * Expense Ratios and Benchmarks for Deals
 * Stores calculated ratios and benchmark comparisons
 * Updated each time expenses are extracted or recalculated
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_expense_ratios', {
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
    // Period this ratio covers (TTM end date)
    period_end: {
      type: DataTypes.STRING(7),
      allowNull: true
    },

    // Labor Ratios
    total_labor_cost: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    labor_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    nursing_labor_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    agency_labor_total: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    agency_pct_of_labor: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    agency_pct_of_direct_care: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Cost per metrics
    labor_cost_per_resident_day: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    total_cost_per_resident_day: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Food/Dietary
    food_cost_total: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    food_cost_per_resident_day: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    food_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    dietary_labor_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Administrative
    admin_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    management_fee_pct: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    bad_debt_pct: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Property/Facilities
    utilities_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    utilities_per_bed: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    property_cost_per_bed: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    maintenance_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Insurance
    insurance_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    insurance_per_bed: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Housekeeping/Laundry
    housekeeping_pct_of_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Department Expense Totals (raw dollar amounts)
    total_direct_care: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Direct Care expenses (nursing staff, CNA, benefits, agency)'
    },
    total_activities: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Activities expenses (staff, supplies, programs)'
    },
    total_culinary: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Culinary/Dietary expenses (food costs, dietary labor)'
    },
    total_housekeeping: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Housekeeping/Laundry expenses'
    },
    total_maintenance: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Maintenance expenses (repairs, utilities, plant operations)'
    },
    total_administration: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Administration expenses (admin salaries, office, professional fees)'
    },
    total_general: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total General expenses (G&A, marketing, insurance, overhead)'
    },
    total_property: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total Property expenses (rent, property taxes, insurance, depreciation)'
    },

    // Revenue metrics
    revenue_per_bed: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    revenue_per_resident_day: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    private_pay_rate_avg: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicaid_rate_avg: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Profitability margins
    ebitdar_margin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda_margin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    operating_margin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Benchmark flags (JSON object with flags for each metric)
    // e.g., { "labor_pct_of_revenue": "above_benchmark", "agency_pct": "critical" }
    benchmark_flags: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('benchmark_flags');
        return rawValue ? JSON.parse(rawValue) : null;
      },
      set(value) {
        this.setDataValue('benchmark_flags', value ? JSON.stringify(value) : null);
      }
    },

    // Potential savings identified (JSON)
    // e.g., { "agency_reduction": 150000, "food_optimization": 25000 }
    potential_savings: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('potential_savings');
        return rawValue ? JSON.parse(rawValue) : null;
      },
      set(value) {
        this.setDataValue('potential_savings', value ? JSON.stringify(value) : null);
      }
    },

    // Metadata
    calculated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
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
    tableName: 'deal_expense_ratios',
    timestamps: false,
    indexes: [
      {
        name: 'idx_expense_ratios_deal_id',
        fields: ['deal_id']
      },
      {
        name: 'idx_expense_ratios_deal_period',
        unique: true,
        fields: ['deal_id', 'period_end']
      }
    ]
  });
};
