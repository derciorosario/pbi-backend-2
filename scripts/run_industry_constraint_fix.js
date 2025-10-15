const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function fixIndustryConstraint() {
  let connection;

  try {
    console.log("🔧 Fixing industry foreign key constraint...");

    // Create connection using the same credentials as your .env file
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'pbi',
      multipleStatements: true
    });

    // Execute the SQL statements one by one
    const sqlStatements = [
      // First, try to drop the constraint (ignore error if it doesn't exist)
      `SET FOREIGN_KEY_CHECKS = 0;`,
      `ALTER TABLE user_industry_categories DROP FOREIGN KEY user_industry_categories_ibfk_12;`,
      `SET FOREIGN_KEY_CHECKS = 1;`,

      // Then, add the correct constraint
      `ALTER TABLE user_industry_categories
       ADD CONSTRAINT user_industry_categories_ibfk_12
       FOREIGN KEY (industryCategoryId) REFERENCES industry_categories(id)
       ON DELETE CASCADE ON UPDATE CASCADE;`
    ];

    for (const sql of sqlStatements) {
      try {
        await connection.execute(sql);
        console.log(`✅ Executed: ${sql.split('\n')[0].trim()}`);
      } catch (error) {
        // Ignore errors for DROP FOREIGN KEY if constraint doesn't exist
        if (sql.includes('DROP FOREIGN KEY') && error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`ℹ️  Constraint doesn't exist, skipping drop`);
          continue;
        }
        // Ignore errors for ADD CONSTRAINT if constraint already exists
        if (sql.includes('ADD CONSTRAINT') && error.code === 'ER_FK_DUP_NAME') {
          console.log(`ℹ️  Constraint already exists, skipping add`);
          continue;
        }
        throw error;
      }
    }

    console.log("✅ Industry foreign key constraint fixed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing industry foreign key constraint:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixIndustryConstraint();