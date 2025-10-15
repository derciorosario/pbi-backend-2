const fs = require("fs");
const path = require("path");
const { Category, Subcategory, Goal } = require("../models");

async function seedIfEmpty() {
  const count = await Category.count();
  if (count > 0) {
    console.log("✅ Categories already exist. Skipping seeding.");
    return;
  }

  console.log("🌱 Seeding categories, subcategories, and goals...");

  // Load categories + subcategories
  const cats = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../seed/categories.full.json"))
  );
  for (const [cat, subs] of Object.entries(cats)) {
    const c = await Category.create({ name: cat });
    for (const s of subs) {
      await Subcategory.create({ categoryId: c.id, name: s });
    }
  }

  // Load goals
  const goals = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../seed/goals.json"))
  );
  for (const g of goals) {
    await Goal.create({ name: g });
  }

  console.log("✅ Seed completed.");
}

module.exports = { seedIfEmpty };
