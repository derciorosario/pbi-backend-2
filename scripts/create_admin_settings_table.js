// scripts/create_admin_settings_table.js
const { sequelize } = require("../src/models");

async function createAdminSettingsTable() {
  try {
    console.log("Creating admin_settings table...");

    await sequelize.query(`DROP TABLE IF EXISTS admin_settings`);

    // Create table
    const createQuery = `
      CREATE TABLE admin_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        newPostNotificationSettings JSON NOT NULL,
        createdBy CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_by (createdBy)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await sequelize.query(createQuery);

    // Insert default settings
    const defaultSettings = {
      enabled: true,
      audienceType: 'all',
      audienceOptions: ['all'],
      excludeCreator: true,
      emailSubject: 'New {{postType}} posted by {{authorName}} on 54Links',
      emailTemplate: 'new-post'
    };

    const insertQuery = `
      INSERT INTO admin_settings (newPostNotificationSettings, createdBy)
      VALUES (?, ?)
    `;

    await sequelize.query(insertQuery, {
      replacements: [JSON.stringify(defaultSettings), '00000000-0000-0000-0000-000000000000']
    });

    console.log("✅ admin_settings table created successfully with default settings");

    return true;
  } catch (error) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

createAdminSettingsTable();