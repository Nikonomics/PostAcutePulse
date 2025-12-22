const { DataTypes } = require('sequelize');

module.exports = function(sequelize) {
  const FacilityComment = sequelize.define('facility_comments', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ccn: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'CCN of the facility (links to CMS facility data)'
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
        model: 'facility_comments',
        key: 'id'
      },
      comment: 'For threaded replies'
    }
  }, {
    tableName: 'facility_comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['ccn'] },
      { fields: ['user_id'] },
      { fields: ['parent_id'] },
      { fields: ['created_at'] }
    ]
  });

  FacilityComment.associate = function(models) {
    FacilityComment.belongsTo(models.users, {
      foreignKey: 'user_id',
      as: 'user'
    });
    FacilityComment.belongsTo(FacilityComment, {
      foreignKey: 'parent_id',
      as: 'parent'
    });
    FacilityComment.hasMany(FacilityComment, {
      foreignKey: 'parent_id',
      as: 'replies'
    });
    FacilityComment.hasMany(models.facility_comment_mentions, {
      foreignKey: 'comment_id',
      as: 'mentions'
    });
  };

  return FacilityComment;
};
