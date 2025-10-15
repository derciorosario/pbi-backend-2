const { sequelize } = require("../src/models");

async function fixConstraintSpecific() {
  try {
    console.log("🔧 Fixing specific foreign key constraint...");

    // First, let's check what constraints exist
    const [constraints] = await sequelize.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'user_industry_categories'
      AND REFERENCED_TABLE_NAME IS NOT NULL;
    `);

    console.log("Current constraints:", constraints);

    // Drop the specific constraint if it exists
    try {
      await sequelize.query(`
        ALTER TABLE user_industry_categories
        DROP FOREIGN KEY user_industry_categories_ibfk_12;
      `);
      console.log("✅ Dropped existing constraint");
    } catch (dropError) {
      console.log("ℹ️ Constraint might not exist:", dropError.message);
    }

    // Add the correct constraint
    await sequelize.query(`
      ALTER TABLE user_industry_categories
      ADD CONSTRAINT user_industry_categories_ibfk_12
      FOREIGN KEY (industryCategoryId) REFERENCES industry_categories(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    console.log("✅ Added correct foreign key constraint");

    // Verify the fix
    const [newConstraints] = await sequelize.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'user_industry_categories'
      AND REFERENCED_TABLE_NAME IS NOT NULL;
    `);

    console.log("Updated constraints:", newConstraints);

  } catch (error) {
    console.error("❌ Error fixing constraint:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixConstraintSpecific()
    .then(() => {
      console.log("🎉 Constraint fix completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Constraint fix failed:", error);
      process.exit(1);
    });
}

module.exports = { fixConstraintSpecific };