// scripts/add_raised_field_to_funding.js
require('dotenv').config(); // Load environment variables from .env file
const { Sequelize } = require('sequelize');
const { makeSequelize } = require('../src/config/db');

async function addRaisedFieldToFunding() {
  console.log('Starting migration: Add raised field to funding table');
  
  const sequelize = makeSequelize();
  
  try {
    // Check if the column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'funding' AND COLUMN_NAME = 'raised'
    `);
    
    if (results.length > 0) {
      console.log('Column "raised" already exists in funding table');
      return;
    }
    
    // Add the raised column to the funding table
    await sequelize.query(`
      ALTER TABLE funding 
      ADD COLUMN raised DECIMAL(12, 2) NOT NULL DEFAULT 0 
      AFTER goal
    `);
    
    console.log('Successfully added "raised" column to funding table');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
    console.log('Migration completed');
  }
}

// Run the migration
addRaisedFieldToFunding();