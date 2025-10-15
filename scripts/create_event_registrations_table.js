async function createEventRegistrationsTable() {
  try {
    console.log("Creating event_registrations table...");

    // Import sequelize after the server has started
    const { sequelize } = require("../src/models");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id CHAR(36) NOT NULL,
        userId CHAR(36) NOT NULL,
        eventId CHAR(36) NOT NULL,
        numberOfPeople INT NOT NULL,
        reasonForAttending TEXT NOT NULL,
        status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (id),
        INDEX idx_user_event (userId, eventId),
        INDEX idx_event (eventId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, {
      raw: true,
      logging: false
    });

    console.log("✅ event_registrations table created successfully");
  } catch (error) {
    if (error.original && error.original.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log("ℹ️ event_registrations table already exists");
    } else {
      console.error("❌ Error creating event_registrations table:", error.message);
      throw error;
    }
  }
}

async function runMigrations() {
  try {
    console.log("Waiting for database operations to settle before migration...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await createEventRegistrationsTable();

    console.log("✅ Event registrations table migration executed successfully");
  } catch (error) {
    console.error("❌ Event registrations table migration failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { createEventRegistrationsTable, runMigrations };