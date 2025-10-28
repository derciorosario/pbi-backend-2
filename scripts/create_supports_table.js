// scripts/create_supports_table.js
const { sequelize } = require("../src/models");

async function createSupportsTable() {
  try {
    console.log("Creating supports table...");

    await sequelize.query(`DROP TABLE IF EXISTS supports`);

    // Create table
    const createQuery = `
      CREATE TABLE supports (
        id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        fullName VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NULL,
        supportReason ENUM('technical', 'account', 'data', 'general', 'other') NOT NULL DEFAULT 'other',
        priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
        message TEXT NOT NULL,
        attachment VARCHAR(500) NULL,
        attachmentName VARCHAR(255) NULL,
        attachmentType VARCHAR(100) NULL,
        status ENUM('new', 'in_progress', 'responded', 'closed') NOT NULL DEFAULT 'new',
        respondedAt DATETIME NULL,
        notes TEXT NULL,
        readAt DATETIME NULL DEFAULT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_email (email),
        INDEX idx_support_reason (supportReason),
        INDEX idx_priority (priority),
        INDEX idx_status (status),
        INDEX idx_created_at (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await sequelize.query(createQuery);
    console.log("✅ supports table created successfully");

    return true;
  } catch (error) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

createSupportsTable();