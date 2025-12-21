const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('user_change_logs', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'The user whose profile was changed'
    },
    changed_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'The user who made the change (could be self or admin)'
    },
    change_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'profile_updated, password_changed, photo_updated, role_changed, status_changed'
    },
    field_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'The field that was changed (e.g., first_name, department)'
    },
    field_label: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Human-readable field label (e.g., "First Name", "Department")'
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
      comment: 'Additional context as JSON'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'user_change_logs',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['changed_by_user_id'] },
      { fields: ['user_id', 'created_at'] },
      { fields: ['change_type'] }
    ]
  });
};
