const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deals', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    master_deal_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    deal_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    deal_type: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    priority_level: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    deal_source: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    facility_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    facility_type: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    no_of_beds: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    street_address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    zip_code: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    primary_contact_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    phone_number: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    target_close_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    dd_period_weeks: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    purchase_price: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    price_per_bed: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    down_payment: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    financing_amount: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    annual_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    revenue_multiple: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda_multiple: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ebitda_margin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    net_operating_income: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    current_occupancy: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    average_daily_rate: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    medicare_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    private_pay_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    target_irr_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    target_hold_period: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    projected_cap_rate_percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    exit_multiple: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    deal_lead_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    assistant_deal_lead_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    deal_status: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: 'pipeline'
    },
    email_notification_major_updates: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'no'
    },
    weekly_progress_report: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'no'
    },
    slack_integration_for_team_communication: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'no'
    },
    calendar_integration: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'no'
    },
    sms_alert_for_urgent_items: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'no'
    },
    document_upload_notification: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'no'
    },
    extraction_data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('extraction_data');
        return rawValue ? JSON.parse(rawValue) : null;
      },
      set(value) {
        this.setDataValue('extraction_data', value ? JSON.stringify(value) : null);
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'deals',
    timestamps: false
  });
};
