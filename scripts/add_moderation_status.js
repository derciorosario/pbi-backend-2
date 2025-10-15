// scripts/add_moderation_status.js
const { sequelize } = require("../src/models");

/**
 * Adds moderation_status column to jobs table with a more robust approach
 * to handle deadlocks and other transient errors
 */
async function addModerationStatusColumn() {
  const MAX_RETRIES = 10;
  let retryCount = 0;
  let success = false;

  // Initial delay to allow other operations to complete
  console.log("Waiting for database operations to settle before migration...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  while (!success && retryCount < MAX_RETRIES) {
    try {
      console.log("Adding moderation_status column to jobs table...");
      
      // Check if the column already exists using a separate connection
      // to avoid transaction conflicts
      const [results] = await sequelize.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'jobs'
        AND COLUMN_NAME = 'moderation_status'
      `, {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
        plain: false,
        logging: false // Reduce noise in logs
      });
      
      if (!results || results.length === 0) {
        // Use a more cautious approach with a longer query timeout
        // and without using transactions
        await sequelize.query(`
          SET SESSION lock_wait_timeout = 50;
          ALTER TABLE jobs
          ADD COLUMN IF NOT EXISTS moderation_status ENUM('approved', 'reported', 'under_review', 'removed', 'suspended')
          NOT NULL DEFAULT 'approved';
        `, {
          raw: true,
          logging: false,
          timeout: 30000 // 30 second timeout
        });
        
        console.log("✅ moderation_status column added successfully");
      } else {
        console.log("✅ moderation_status column already exists");
      }
      
      success = true;
      return true; // Successfully completed
    } catch (error) {
      retryCount++;
      
      // Check if it's a deadlock error
      const isDeadlock = error.name === 'SequelizeDatabaseError' &&
                         error.parent &&
                         (error.parent.code === 'ER_LOCK_DEADLOCK' ||
                          error.parent.code === 'ER_LOCK_WAIT_TIMEOUT');
      
      if ((isDeadlock || error.message.includes('deadlock')) && retryCount < MAX_RETRIES) {
        // Calculate exponential backoff delay with jitter to avoid synchronized retries
        const baseDelay = 1000 * Math.pow(2, retryCount - 1);
        const jitter = Math.floor(Math.random() * 1000);
        const delay = Math.min(baseDelay + jitter, 15000);
        
        console.log(`Deadlock detected, retrying in ${delay}ms (attempt ${retryCount} of ${MAX_RETRIES})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (retryCount >= MAX_RETRIES) {
        console.error(`❌ Maximum retry attempts (${MAX_RETRIES}) reached. Migration failed.`);
        console.error("❌ Error adding moderation_status column:", error);
        return false;
      } else {
        console.error("❌ Error adding moderation_status column:", error);
        return false;
      }
    }
  }
  
  return success;
}

// Export the function instead of running it immediately
module.exports = { addModerationStatusColumn };