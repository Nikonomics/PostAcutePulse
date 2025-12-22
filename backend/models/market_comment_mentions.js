const { DataTypes } = require('sequelize');

module.exports = function(sequelize) {
  const MarketCommentMention = sequelize.define('market_comment_mentions', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'market_comments',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    mentioned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'market_comment_mentions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['comment_id'] },
      { fields: ['mentioned_user_id'] }
    ]
  });

  MarketCommentMention.associate = function(models) {
    MarketCommentMention.belongsTo(models.market_comments, {
      foreignKey: 'comment_id',
      as: 'comment'
    });
    MarketCommentMention.belongsTo(models.users, {
      foreignKey: 'mentioned_user_id',
      as: 'mentionedUser'
    });
  };

  return MarketCommentMention;
};
