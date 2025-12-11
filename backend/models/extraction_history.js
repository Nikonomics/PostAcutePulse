const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('extraction_history', {
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
      },
      onDelete: 'CASCADE'
    },
    extraction_data: {
      type: DataTypes.TEXT,
      allowNull: false,
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
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'ai_extraction, manual_edit, alf_match, bulk_import, facility_sync'
    },
    changed_fields: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('changed_fields');
        if (!rawValue) return [];
        try {
          return JSON.parse(rawValue);
        } catch {
          return rawValue.split(',');
        }
      },
      set(value) {
        if (Array.isArray(value)) {
          this.setDataValue('changed_fields', JSON.stringify(value));
        } else {
          this.setDataValue('changed_fields', value);
        }
      }
    },
    created_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'User email or system identifier'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'extraction_history',
    timestamps: false,
    indexes: [
      {
        name: 'idx_extraction_history_deal_id',
        fields: ['deal_id']
      },
      {
        name: 'idx_extraction_history_created_at',
        fields: ['created_at']
      }
    ]
  });
};
