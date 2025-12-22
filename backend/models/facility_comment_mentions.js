const { DataTypes } = require('sequelize');

module.exports = function(sequelize) {
  const FacilityCommentMention = sequelize.define('facility_comment_mentions', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'facility_comments',
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
    tableName: 'facility_comment_mentions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['comment_id'] },
      { fields: ['mentioned_user_id'] }
    ]
  });

  FacilityCommentMention.associate = function(models) {
    FacilityCommentMention.belongsTo(models.facility_comments, {
      foreignKey: 'comment_id',
      as: 'comment'
    });
    FacilityCommentMention.belongsTo(models.users, {
      foreignKey: 'mentioned_user_id',
      as: 'mentionedUser'
    });
  };

  return FacilityCommentMention;
};
