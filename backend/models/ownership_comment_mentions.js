const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('ownership_comment_mentions', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    mentioned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'ownership_comment_mentions',
    timestamps: false,
    indexes: [
      { fields: ['comment_id'] },
      { fields: ['mentioned_user_id'] }
    ]
  });
};
