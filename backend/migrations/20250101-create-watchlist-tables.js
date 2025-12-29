/**
 * Migration: Create Watchlist Tables
 *
 * Creates the watchlists and watchlist_items tables for the
 * Market Intelligence platform.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create watchlists table
    await queryInterface.createTable('watchlists', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes to watchlists
    await queryInterface.addIndex('watchlists', ['user_id']);
    await queryInterface.addIndex('watchlists', ['is_primary']);

    console.log('Created watchlists table');

    // Create watchlist_items table
    await queryInterface.createTable('watchlist_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      watchlist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'watchlists',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ccn: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      provider_type: {
        type: Sequelize.ENUM('SNF', 'HHA', 'HOSPICE'),
        allowNull: false,
        defaultValue: 'SNF'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes to watchlist_items
    await queryInterface.addIndex('watchlist_items', ['watchlist_id']);
    await queryInterface.addIndex('watchlist_items', ['ccn']);
    await queryInterface.addIndex('watchlist_items', ['provider_type']);
    await queryInterface.addIndex('watchlist_items', ['watchlist_id', 'ccn'], {
      unique: true,
      name: 'watchlist_items_unique_ccn_per_list'
    });

    console.log('Created watchlist_items table');
    console.log('Watchlist tables migration complete.');
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order (child first)
    await queryInterface.dropTable('watchlist_items');
    await queryInterface.dropTable('watchlists');
    console.log('Dropped watchlist tables.');
  }
};
