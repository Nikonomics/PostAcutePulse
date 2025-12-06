/**
 * Extracted Text Storage for Deals
 * Stores the raw text extracted from uploaded documents
 * Allows re-running analysis without re-uploading documents
 */
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deal_extracted_text', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    deal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'deals',
        key: 'id'
      }
    },
    // Link to document if stored
    document_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'deal_documents',
        key: 'id'
      }
    },
    // Original filename
    filename: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    // MIME type
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Document type detected (P&L, Census, Rate Schedule, etc.)
    document_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    // Extracted text content
    extracted_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Character count for quick reference
    text_length: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    // Period information detected
    period_start: {
      type: DataTypes.STRING(7),
      allowNull: true
    },
    period_end: {
      type: DataTypes.STRING(7),
      allowNull: true
    },

    // Extraction metadata
    extraction_method: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    page_count: {
      type: DataTypes.INTEGER,
      allowNull: true
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
    tableName: 'deal_extracted_text',
    timestamps: false,
    indexes: [
      {
        name: 'idx_extracted_text_deal_id',
        fields: ['deal_id']
      },
      {
        name: 'idx_extracted_text_doc_type',
        fields: ['deal_id', 'document_type']
      }
    ]
  });
};
