require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  sequelize,
  Identity,
  Category,
  Subcategory,
  SubsubCategory,
  Goal,
} = require("../src/models");

async function run() {
  await sequelize.authenticate();
  console.log("🔌 DB connected.");

  const tree = JSON.parse(fs.readFileSync(path.join(__dirname, "../seed/identities.tree.json"), "utf8"));

  for (const node of tree) {
    const identity = await Identity.create({
      name: node.name,
      group: node.group || null,
      sort: Number.isFinite(+node.sort) ? +node.sort : 0,
    });

    for (const c of node.categories || []) {
      const cat = await Category.create({
        name: c.name,
        identityId: identity.id, // can be null, but here we tie it
      });

      for (const s of c.subcategories || []) {
        const sub = await Subcategory.create({
          categoryId: cat.id,
          name: s.name,
        });

        for (const x of s.subsubs || []) {
          await SubsubCategory.create({
            categoryId: cat.id,
            subcategoryId: sub.id,
            name: x,
          });
        }
      }
    }
  }

  console.log("✅ Seeded identities + categories tree.");

  // If you still seed legacy goals:
  const goalsPath = path.join(__dirname, "goals.json");
  if (fs.existsSync(goalsPath)) {
    const goals = JSON.parse(fs.readFileSync(goalsPath, "utf8"));
    for (const g of goals) {
      const clean = String(g).trim().replace(/\s+/g, " ");
      try {
        await Goal.create({ name: clean });
      } catch (_) {}
    }
    console.log("✅ Seeded goals.");
  }

  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
