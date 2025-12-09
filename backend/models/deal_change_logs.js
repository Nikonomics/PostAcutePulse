const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_change_logs', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    deal_id: {
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
      comment: 'field_update, status_change, comment_added, document_added, team_member_added, team_member_removed'
    },
    field_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'The field that was changed (e.g., deal_name, purchase_price)'
    },
    field_label: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Human-readable field label (e.g., "Deal Name", "Purchase Price")'
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
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON: Additional context like comment_id, document_name, etc.'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'deal_change_logs',
    timestamps: false,
    indexes: [
      { fields: ['deal_id'] },
      { fields: ['user_id'] },
      { fields: ['deal_id', 'created_at'] },
      { fields: ['change_type'] }
    ]
  });
};
