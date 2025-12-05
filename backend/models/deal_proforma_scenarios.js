const Sequelize = require('sequelize');

/**
 * Saved pro forma scenarios for a specific deal
 * Each deal can have multiple scenarios (Base Case, Upside, Downside)
 */
module.exports = function (sequelize, DataTypes) {
  const DealProformaScenario = sequelize.define('deal_proforma_scenarios', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    deal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'deals',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    scenario_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Base Case'
    },

    // Benchmark overrides (JSON - only stores values that differ from user's default)
    benchmark_overrides: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('benchmark_overrides');
        return raw ? JSON.parse(raw) : {};
      },
      set(value) {
        this.setDataValue('benchmark_overrides', value ? JSON.stringify(value) : null);
      }
    },

    // Calculated outputs (cached for quick display)
    stabilized_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    stabilized_ebitda: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    stabilized_ebitdar: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    stabilized_noi: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    total_opportunity: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    total_opportunity_pct: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Stabilized metrics
    stabilized_occupancy: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    stabilized_private_pay_mix: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    stabilized_labor_pct: {
      type: DataTypes.FLOAT,
      allowNull: true
    },

    // Detailed opportunity breakdown (JSON)
    opportunities: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('opportunities');
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue('opportunities', value ? JSON.stringify(value) : null);
      }
    },

    // Year-over-year projections (JSON)
    // Array of { year: 1, revenue: X, ebitda: Y, ebitdar: Z, occupancy: O }
    yearly_projections: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('yearly_projections');
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue('yearly_projections', value ? JSON.stringify(value) : null);
      }
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
    tableName: 'deal_proforma_scenarios',
    timestamps: false
  });

  // Define associations
  DealProformaScenario.associate = function(models) {
    DealProformaScenario.belongsTo(models.deals, {
      foreignKey: 'deal_id',
      as: 'deal'
    });
    DealProformaScenario.belongsTo(models.users, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return DealProformaScenario;
};
