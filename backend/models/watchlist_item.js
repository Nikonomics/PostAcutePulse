/**
 * WatchlistItem Model
 *
 * Stores individual facility items within a watchlist.
 * Links to CMS data via CCN (CMS Certification Number).
 */
module.exports = function (sequelize, DataTypes) {
  const WatchlistItem = sequelize.define('watchlist_items', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    watchlist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'watchlists',
        key: 'id'
      }
    },
    ccn: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'CMS Certification Number - links to CMS facility data'
    },
    provider_type: {
      type: DataTypes.ENUM('SNF', 'HHA', 'HOSPICE'),
      allowNull: false,
      defaultValue: 'SNF'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'watchlist_items',
    timestamps: false,
    indexes: [
      { fields: ['watchlist_id'] },
      { fields: ['ccn'] },
      { fields: ['provider_type'] },
      {
        unique: true,
        fields: ['watchlist_id', 'ccn'],
        name: 'watchlist_items_unique_ccn_per_list'
      }
    ]
  });

  WatchlistItem.associate = function(models) {
    WatchlistItem.belongsTo(models.watchlists, {
      foreignKey: 'watchlist_id',
      as: 'watchlist'
    });
  };

  return WatchlistItem;
};
