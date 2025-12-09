module.exports = (sequelize, DataTypes) => {
  const UserNotification = sequelize.define('user_notifications', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    from_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    to_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    notification_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'signup, approval, rejection, comment, mention, deal_update'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    ref_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    ref_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'user, deal, comment'
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }
  }, {
    tableName: 'user_notifications',
    timestamps: true
  });

  // Define associations
  UserNotification.associate = function(models) {
    UserNotification.belongsTo(models.users, {
      foreignKey: 'from_id',
      as: 'fromUser'
    });
    UserNotification.belongsTo(models.users, {
      foreignKey: 'to_id',
      as: 'toUser'
    });
  };

  return UserNotification;
};
