const Sequelize = require('sequelize');

/**
 * User's saved benchmark configurations
 * Users can have multiple saved configurations (e.g., "Conservative", "Aggressive", "Default")
 */
module.exports = function (sequelize, DataTypes) {
  const BenchmarkConfiguration = sequelize.define('benchmark_configurations', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    config_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Default'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },

    // Operational targets
    occupancy_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.85
    },
    private_pay_mix_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.35
    },

    // Expense benchmarks (as % of revenue or per unit)
    labor_pct_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.55
    },
    labor_pct_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.62
    },
    labor_pct_critical: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.68
    },

    agency_pct_of_labor_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.02
    },
    agency_pct_of_labor_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.05
    },
    agency_pct_of_labor_critical: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.10
    },

    food_cost_per_day_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 10.50
    },
    food_cost_per_day_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 13.00
    },
    food_cost_per_day_critical: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 16.00
    },

    management_fee_pct_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.04
    },
    management_fee_pct_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.05
    },
    management_fee_pct_critical: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.06
    },

    bad_debt_pct_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.005
    },
    bad_debt_pct_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.01
    },
    bad_debt_pct_critical: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.02
    },

    utilities_pct_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.025
    },
    utilities_pct_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.035
    },
    utilities_pct_critical: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.045
    },

    insurance_pct_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.03
    },

    // Margin targets
    ebitda_margin_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.09
    },
    ebitdar_margin_target: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.23
    },

    // Timing
    stabilization_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 18
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
    tableName: 'benchmark_configurations',
    timestamps: false
  });

  // Define associations
  BenchmarkConfiguration.associate = function(models) {
    BenchmarkConfiguration.belongsTo(models.users, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return BenchmarkConfiguration;
};
