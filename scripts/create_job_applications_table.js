// scripts/create_job_applications_table.js
const { sequelize } = require("../src/models");

/**
 * Creates the job_applications table
 */
async function createJobApplicationsTable() {
  try {
    console.log("Creating job_applications table...");

    // Check if table already exists
    const [results] = await sequelize.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'job_applications'
    `, {
      type: sequelize.QueryTypes.SELECT,
      raw: true,
      plain: false,
      logging: false
    });

    // Drop table if exists and recreate
    await sequelize.query(`DROP TABLE IF EXISTS job_applications`, {
      raw: true,
      logging: false
    });

    await sequelize.query(`
      CREATE TABLE job_applications (
        id CHAR(36) NOT NULL,
        userId CHAR(36) NOT NULL,
        jobId CHAR(36) NOT NULL,
        coverLetter TEXT NOT NULL,
        expectedSalary VARCHAR(100),
        availability ENUM('immediate', '1month', 'specific'),
        availabilityDate DATE,
        employmentType ENUM('full-time', 'part-time', 'contract', 'internship', 'remote', 'hybrid', 'onsite'),
        status ENUM('pending', 'reviewed', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (id),
        INDEX idx_user_job (userId, jobId),
        INDEX idx_job (jobId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, {
      raw: true,
      logging: false
    });

    console.log("✅ job_applications table created successfully");

    return true;
  } catch (error) {
    console.error("❌ Error creating job_applications table:", error);
    return false;
  }
}

module.exports = { createJobApplicationsTable };