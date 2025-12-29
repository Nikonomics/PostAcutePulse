/**
 * Watchlist Model
 *
 * Stores user-created watchlists for tracking facilities.
 * Each user can have multiple watchlists with one marked as primary.
 */
module.exports = function (sequelize, DataTypes) {
  const Watchlist = sequelize.define('watchlists', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'watchlists',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['is_primary'] }
    ]
  });

  Watchlist.associate = function(models) {
    Watchlist.belongsTo(models.users, {
      foreignKey: 'user_id',
      as: 'user'
    });
    Watchlist.hasMany(models.watchlist_items, {
      as: 'items',
      foreignKey: 'watchlist_id'
    });
  };

  return Watchlist;
};
