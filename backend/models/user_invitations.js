const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  const UserInvitations = sequelize.define('user_invitations', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'analyst',
      comment: "admin,deal_manager,analyst,viewer"
    },
    invited_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      comment: "pending, accepted, expired, cancelled"
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'user_invitations',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['token']
      },
      {
        fields: ['email', 'status']
      }
    ]
  });

  // Define association
  UserInvitations.associate = function(models) {
    UserInvitations.belongsTo(models.users, {
      foreignKey: 'invited_by',
      as: 'inviter'
    });
  };

  return UserInvitations;
};
