const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('facility_change_logs', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    facility_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'References deal_facilities.id'
    },
    deal_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'The deal this facility belongs to'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'The user who made the change'
    },
    change_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'field_update, facility_added, facility_removed, financial_update, operational_update'
    },
    field_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'The field that was changed'
    },
    field_label: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Human-readable field label'
    },
    old_value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    new_value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional context as JSON (facility name, etc.)'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'facility_change_logs',
    timestamps: false,
    indexes: [
      { fields: ['facility_id'] },
      { fields: ['deal_id'] },
      { fields: ['user_id'] },
      { fields: ['facility_id', 'created_at'] },
      { fields: ['change_type'] }
    ]
  });
};
