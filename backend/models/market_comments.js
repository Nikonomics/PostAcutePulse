const { DataTypes } = require('sequelize');

module.exports = function(sequelize) {
  const MarketComment = sequelize.define('market_comments', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    state: {
      type: DataTypes.STRING(2),
      allowNull: false,
      comment: 'State code (e.g., CO, TX)'
    },
    county: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'County name'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'market_comments',
        key: 'id'
      },
      comment: 'For threaded replies'
    }
  }, {
    tableName: 'market_comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['state', 'county'] },
      { fields: ['user_id'] },
      { fields: ['parent_id'] },
      { fields: ['created_at'] }
    ]
  });

  MarketComment.associate = function(models) {
    MarketComment.belongsTo(models.users, {
      foreignKey: 'user_id',
      as: 'user'
    });
    MarketComment.belongsTo(MarketComment, {
      foreignKey: 'parent_id',
      as: 'parent'
    });
    MarketComment.hasMany(MarketComment, {
      foreignKey: 'parent_id',
      as: 'replies'
    });
    MarketComment.hasMany(models.market_comment_mentions, {
      foreignKey: 'comment_id',
      as: 'mentions'
    });
  };

  return MarketComment;
};
