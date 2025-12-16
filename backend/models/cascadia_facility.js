const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CascadiaFacility = sequelize.define('CascadiaFacility', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    facility_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'SNF, ALF, ILF, Home Office'
    },
    pcc_id: {
      type: DataTypes.INTEGER
    },
    finance_id: {
      type: DataTypes.INTEGER
    },
    paylocity_id: {
      type: DataTypes.INTEGER
    },
    address: {
      type: DataTypes.STRING(255)
    },
    city: {
      type: DataTypes.STRING(100)
    },
    state: {
      type: DataTypes.STRING(2)
    },
    zip: {
      type: DataTypes.STRING(10)
    },
    county: {
      type: DataTypes.STRING(100)
    },
    telephone: {
      type: DataTypes.STRING(20)
    },
    fax: {
      type: DataTypes.STRING(20)
    },
    ar_start_date: {
      type: DataTypes.DATE
    },
    company: {
      type: DataTypes.STRING(100),
      comment: 'Columbia, Envision, Three Rivers, Northern, Vincero, Olympus, Home Office Region'
    },
    team: {
      type: DataTypes.STRING(100),
      comment: 'Pacific Storm, Triple Threat, Palouse PAC, etc.'
    },
    beds: {
      type: DataTypes.INTEGER
    },
    npi: {
      type: DataTypes.STRING(20)
    },
    ccn: {
      type: DataTypes.STRING(20)
    },
    ein: {
      type: DataTypes.STRING(20)
    },
    timezone_offset: {
      type: DataTypes.INTEGER
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7)
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7)
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'current_operations',
      comment: 'Always current_operations for Cascadia facilities'
    }
  }, {
    tableName: 'cascadia_facilities',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['type'] },
      { fields: ['company'] },
      { fields: ['team'] },
      { fields: ['state'] },
      { fields: ['status'] }
    ]
  });

  return CascadiaFacility;
};
