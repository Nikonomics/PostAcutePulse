const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('ownership_change_logs', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    ownership_profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    change_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'profile_created, profile_updated, contact_added, contact_updated, contact_deleted, comment_added, comment_deleted'
    },
    field_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'The field that was changed (for profile_updated)'
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
      comment: 'Additional context as JSON (e.g., contact name, comment preview)'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'ownership_change_logs',
    timestamps: false,
    indexes: [
      { fields: ['ownership_profile_id'] },
      { fields: ['user_id'] },
      { fields: ['ownership_profile_id', 'created_at'] },
      { fields: ['change_type'] }
    ]
  });
};
