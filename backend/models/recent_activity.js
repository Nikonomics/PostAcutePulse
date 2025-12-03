const Sequelize = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const RecentActivity = sequelize.define('recent_activities', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    to_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    from_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    subject_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    subject_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    data: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_team: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    }
  }, {
    tableName: 'recent_activities',
    timestamps: true
  });

  return RecentActivity;
};
