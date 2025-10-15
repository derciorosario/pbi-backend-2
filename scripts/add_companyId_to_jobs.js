"use strict";

// Load environment variables first
require("dotenv").config();

const { sequelize } = require("../src/models");
const path = require("path");

async function addCompanyIdToJobs() {
  try {
    // Import the migration file
    const migration = require("../backend/migrations/20250915T183000-add-companyId-to-jobs.js");
    
    // Execute the migration
    await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    
    console.log("✅ Successfully added companyId column to jobs table");
    return true;
  } catch (error) {
    console.error("❌ Error adding companyId to jobs:", error);
    return false;
  }
}

// Allow running directly from command line
if (require.main === module) {
  addCompanyIdToJobs()
    .then(result => {
      console.log(`Migration ${result ? "completed successfully" : "failed"}`);
      process.exit(result ? 0 : 1);
    })
    .catch(err => {
      console.error("Migration failed with error:", err);
      process.exit(1);
    });
}

module.exports = { addCompanyIdToJobs };