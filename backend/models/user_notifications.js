module.exports = (sequelize, DataTypes) => {
  return sequelize.define('user_notifications', {
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
      type: DataTypes.STRING(20),
      allowNull: false
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
};
