/**
 * Custom Reports Model
 *
 * Stores user-created report configurations for the drag-and-drop report builder.
 * Configuration is stored as JSONB containing dimensions, metrics, filters, and visualization settings.
 */
module.exports = function (sequelize, DataTypes) {
  const CustomReport = sequelize.define('custom_reports', {
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    configuration: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Full report definition: blocks, queries, visualizations'
    },
    is_template: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    template_category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Category for templates: survey, financial, screening, vbp'
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
    tableName: 'custom_reports',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['is_template'] },
      { fields: ['is_public'] },
      { fields: ['template_category'] }
    ]
  });

  CustomReport.associate = function(models) {
    CustomReport.belongsTo(models.users, {
      foreignKey: 'user_id',
      as: 'creator'
    });
  };

  return CustomReport;
};
