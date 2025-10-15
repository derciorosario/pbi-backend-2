const { sequelize } = require("../models");

async function resetAndRestart() {
  console.log("⚠️  WARNING: Resetting database...");
  await sequelize.sync({ force: true }); // Drops & recreates tables
  console.log("✅ Database reset complete. Restarting server...");

  // Kill the process; nodemon/pm2 will restart automatically
  process.exit(0);
}

module.exports = { resetAndRestart };
