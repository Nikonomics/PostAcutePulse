#!/usr/bin/env node
/**
 * Reset Admin User Script
 *
 * Resets or creates the admin user for local development.
 * Usage: node backend/scripts/reset-admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const path = require('path');

const ADMIN_EMAIL = 'admin@snfalyze.com';
const ADMIN_PASSWORD = 'password123';

async function resetAdmin() {
  let sequelize;

  try {
    // Connect to database
    if (process.env.DATABASE_URL) {
      sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: process.env.NODE_ENV === 'production' ? {
            require: true,
            rejectUnauthorized: false
          } : false
        }
      });
    } else {
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '..', 'database.sqlite'),
        logging: false
      });
    }

    await sequelize.authenticate();
    console.log('Connected to database');

    // Hash the password
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('Password hash generated');

    // Check if user exists
    const [results] = await sequelize.query(
      `SELECT id, email, role, status FROM users WHERE email = :email`,
      { replacements: { email: ADMIN_EMAIL } }
    );

    if (results.length > 0) {
      // User exists - update password
      const user = results[0];
      console.log(`Found existing user: ${user.email} (ID: ${user.id}, Role: ${user.role}, Status: ${user.status})`);

      await sequelize.query(
        `UPDATE users SET password = :password, status = 'active' WHERE email = :email`,
        { replacements: { password: passwordHash, email: ADMIN_EMAIL } }
      );
      console.log(`Updated password and set status to 'active' for ${ADMIN_EMAIL}`);
    } else {
      // User doesn't exist - create new
      console.log('Admin user not found, creating new user...');

      await sequelize.query(`
        INSERT INTO users (first_name, last_name, email, password, role, status, phone_number, department, "createdAt", "updatedAt")
        VALUES (:first_name, :last_name, :email, :password, :role, :status, :phone_number, :department, NOW(), NOW())
      `, {
        replacements: {
          first_name: 'Admin',
          last_name: 'User',
          email: ADMIN_EMAIL,
          password: passwordHash,
          role: 'admin',
          status: 'active',
          phone_number: '555-0100',
          department: 'Administration'
        }
      });
      console.log(`Created new admin user: ${ADMIN_EMAIL}`);
    }

    console.log('\n========================================');
    console.log('Admin user ready!');
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('========================================\n');

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error.message);
    if (sequelize) await sequelize.close();
    process.exit(1);
  }
}

resetAdmin();
