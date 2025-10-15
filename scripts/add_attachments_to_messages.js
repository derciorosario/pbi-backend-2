// scripts/add_attachments_to_messages.js
const { sequelize } = require("../src/models");

/**
 * Adds 'attachments' column to messages table if missing.
 * Uses direct SQL to avoid sequelize-cli migration conflicts in this project.
 */
async function addAttachmentsColumnToMessages() {
  const MAX_RETRIES = 5;
  let retry = 0;

  // small delay to avoid racing with other startup SQL
  await new Promise((r) => setTimeout(r, 2000));

  while (retry < MAX_RETRIES) {
    try {
      console.log("Checking for attachments column in messages...");
      const [rows] = await sequelize.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'messages'
          AND COLUMN_NAME = 'attachments'
      `,
        {
          type: sequelize.QueryTypes.SELECT,
          raw: true,
          plain: false,
          logging: false,
        }
      );

      const exists = Array.isArray(rows) ? rows.length > 0 : !!rows;
      if (exists) {
        console.log("✅ attachments column already exists on messages");
        return true;
      }

      // MySQL JSON default values can be tricky across versions; prefer NULL then handle defaults in app
      console.log("Adding attachments column to messages...");
      await sequelize.query(
        `
        SET SESSION lock_wait_timeout = 50;
        ALTER TABLE messages
          ADD COLUMN attachments JSON NULL;
      `,
        { raw: true, logging: false, timeout: 30000 }
      );

      console.log("✅ attachments column added successfully to messages");
      return true;
    } catch (err) {
      retry++;
      const isDeadlock =
        err?.name === "SequelizeDatabaseError" &&
        err?.parent &&
        (err.parent.code === "ER_LOCK_DEADLOCK" ||
          err.parent.code === "ER_LOCK_WAIT_TIMEOUT");

      if (isDeadlock && retry < MAX_RETRIES) {
        const base = 1000 * Math.pow(2, retry - 1);
        const jitter = Math.floor(Math.random() * 750);
        const delay = Math.min(base + jitter, 10000);
        console.warn(
          `Deadlock/timeout while adding attachments column, retrying in ${delay}ms (attempt ${retry}/${MAX_RETRIES})...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (retry >= MAX_RETRIES) {
        console.error("❌ Failed to add attachments column to messages after retries", err);
        return false;
      }

      console.error("❌ Error adding attachments column to messages", err);
      return false;
    }
  }

  return false;
}

module.exports = { addAttachmentsColumnToMessages };