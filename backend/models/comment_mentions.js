module.exports = (sequelize, DataTypes) => {
  return sequelize.define('comment_mentions', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    mentioned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'comment_mentions',
    timestamps: true
  });
};
