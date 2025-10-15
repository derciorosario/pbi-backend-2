const { sequelize } = require("../src/models");
const fs = require("fs");
const path = require("path");

async function runSqlFix() {
  try {
    console.log("🔧 Running SQL fix for industry foreign key constraint...");

    // Read the SQL file
    const sqlFile = path.join(__dirname, "fix_industry_constraint.sql");
    const sqlContent = fs.readFileSync(sqlFile, "utf8");

    // Split the SQL into individual statements
    const statements = sqlContent
      .split(";")
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith("--"));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await sequelize.query(statement);
      }
    }

    console.log("✅ SQL fix executed successfully!");
  } catch (error) {
    console.error("❌ Error running SQL fix:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  runSqlFix()
    .then(() => {
      console.log("🎉 Database fix completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Database fix failed:", error);
      process.exit(1);
    });
}

module.exports = { runSqlFix };