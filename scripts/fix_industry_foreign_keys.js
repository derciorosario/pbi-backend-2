const { sequelize } = require("../src/models");

async function fixIndustryForeignKeys() {
  try {
    console.log("🔧 Fixing industry foreign key constraints...");

    // Drop the incorrect foreign key constraint
    await sequelize.query(`
      ALTER TABLE user_industry_categories
      DROP FOREIGN KEY user_industry_categories_ibfk_12;
    `);

    // Add the correct foreign key constraint
    await sequelize.query(`
      ALTER TABLE user_industry_categories
      ADD CONSTRAINT user_industry_categories_ibfk_12
      FOREIGN KEY (industryCategoryId) REFERENCES industry_categories(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    console.log("✅ Industry foreign key constraints fixed successfully!");
  } catch (error) {
    console.error("❌ Error fixing industry foreign keys:", error);
    throw error;
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixIndustryForeignKeys()
    .then(() => {
      console.log("🎉 Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { fixIndustryForeignKeys };