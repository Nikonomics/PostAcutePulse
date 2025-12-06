/**
 * Monthly Expense Details for Deals
 * Stores detailed expense breakdown by department/category
 * Each row represents one month's expenses for one department
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_monthly_expenses', {
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
    // Department/Category (e.g., "nursing", "dietary", "housekeeping", "admin")
    department: {
      type: DataTypes.STRING(50),
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

    // Labor costs
    salaries_wages: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    benefits: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    payroll_taxes: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    agency_labor: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    contract_labor: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    total_labor: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Non-labor costs
    supplies: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    food_cost: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    utilities: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    repairs_maintenance: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    other_expenses: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Total for this department
    total_department_expense: {
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
    tableName: 'deal_monthly_expenses',
    timestamps: false,
    indexes: [
      {
        name: 'idx_monthly_expenses_deal_month_dept',
        unique: true,
        fields: ['deal_id', 'month', 'department']
      },
      {
        name: 'idx_monthly_expenses_deal_id',
        fields: ['deal_id']
      },
      {
        name: 'idx_monthly_expenses_department',
        fields: ['department']
      }
    ]
  });
};
