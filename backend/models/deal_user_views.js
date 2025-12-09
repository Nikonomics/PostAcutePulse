const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_user_views', {
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
    last_viewed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'deal_user_views',
    timestamps: false,
    indexes: [
      {
        fields: ['deal_id', 'user_id'],
        unique: true,
        name: 'idx_deal_user_views_unique'
      },
      { fields: ['user_id'] }
    ]
  });
};
