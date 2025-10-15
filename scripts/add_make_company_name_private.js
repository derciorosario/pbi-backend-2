// Migration script to add make_company_name_private field to jobs table
require('dotenv').config();
const { makeSequelize } = require('../src/config/db');

async function runMigration() {
  const sequelize = makeSequelize();
  
  try {
    console.log('Starting migration: Adding make_company_name_private field to jobs table');
    
    // Check if the column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'jobs' 
      AND COLUMN_NAME = 'make_company_name_private'
    `);
    
    if (results.length === 0) {
      // Add the column if it doesn't exist
      await sequelize.query(`
        ALTER TABLE jobs 
        ADD COLUMN make_company_name_private BOOLEAN DEFAULT false
      `);
      console.log('Successfully added make_company_name_private field to jobs table');
    } else {
      console.log('Column make_company_name_private already exists in jobs table');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

runMigration();