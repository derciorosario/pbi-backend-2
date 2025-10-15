// scripts/add_type_field_to_taxonomy_tables.js
require('dotenv').config(); // Load environment variables from .env file
const { Sequelize } = require('sequelize');
const { makeSequelize } = require('../src/config/db');

async function addTypeFieldToTaxonomyTables() {
  console.log('Starting migration: Add type field to taxonomy tables');
  
  const sequelize = makeSequelize();
  
  try {
    // Tables to update
    const tables = [
      'identities',
      'categories',
      'subcategories',
      'subsubcategories'
    ];
    
    for (const table of tables) {
      // Check if the column already exists
      const [results] = await sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'type'
      `);
      
      if (results.length > 0) {
        console.log(`Column "type" already exists in ${table} table`);
        continue;
      }
      
      // First, check if the ENUM type exists
      const [enumExists] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_TYPE = "enum('individual','company')"
      `);
      
      // Add the type column to the table
      await sequelize.query(`
        ALTER TABLE ${table} 
        ADD COLUMN type ENUM('individual', 'company') NOT NULL DEFAULT 'individual'
      `);
      
      console.log(`Successfully added "type" column to ${table} table`);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
    console.log('Migration process finished');
  }
}

// Run the migration
addTypeFieldToTaxonomyTables();