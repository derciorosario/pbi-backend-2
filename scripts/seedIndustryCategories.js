// scripts/seedIndustryCategories.js
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  sequelize,
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
} = require("../src/models"); // adjust if needed

/**
 * Preserves JSON order WITHOUT adding fields by setting createdAt/updatedAt
 * in strictly increasing order. Read later with ORDER BY createdAt ASC.
 *
 * Optional: --reset to truncate before seeding
 *   node scripts/seedIndustryCategories.js --reset
 */

async function seed() {
  const categoriesPath = path.join(__dirname, "../seed/industryCategories.json");
  const industries = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));

  const tx = await sequelize.transaction();
  try {
    if (process.argv.includes("--reset")) {
      await IndustrySubsubCategory.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
      await IndustrySubcategory.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
      await IndustryCategory.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
    }

    // deterministic global ordering across all rows
    const base = Date.now();
    let tick = 0;
    const nextTime = () => new Date(base + 1000 * (tick++));

    for (const ind of industries) {
      if (!ind?.name) continue;

      // 1) Top-level "IndustryCategory" (e.g., "Agriculture")
      const t1 = nextTime();
      const industry = await IndustryCategory.create({
        id: uuidv4(),
        name: ind.name,
        createdAt: t1,
        updatedAt: t1,
      }, { transaction: tx });

      // 2) Loop categories (JSON: ind.categories) → our model: IndustrySubcategory
      if (Array.isArray(ind.categories)) {
        for (const cat of ind.categories) {
          if (!cat?.name) continue;

          const t2 = nextTime();
          const subcategory = await IndustrySubcategory.create({
            id: uuidv4(),
            name: cat.name,                // keep JSON order via timestamps
            industryCategoryId: industry.id,
            createdAt: t2,
            updatedAt: t2,
          }, { transaction: tx });

          // 3) Loop each "sub" inside cat.subcategories
          if (Array.isArray(cat.subcategories)) {
            for (const sub of cat.subcategories) {
              // Case A: plain string -> treat as leaf (IndustrySubsubCategory)
              if (typeof sub === "string" && sub.trim()) {
                const t3 = nextTime();
                await IndustrySubsubCategory.create({
                  id: uuidv4(),
                  name: sub.trim(),
                  industrySubcategoryId: subcategory.id,
                  createdAt: t3,
                  updatedAt: t3,
                }, { transaction: tx });
                continue;
              }

              // Case B: object with name and optional "subsubs" array
              if (sub && typeof sub === "object") {
                const subName = (sub.name || "").trim();

                // If it has "subsubs" (array), create one leaf per subsub in order
                if (Array.isArray(sub.subsubs) && sub.subsubs.length) {
                  for (const subsubNameRaw of sub.subsubs) {
                    const subsubName = (subsubNameRaw || "").trim();
                    if (!subsubName) continue;
                    const t4 = nextTime();
                    await IndustrySubsubCategory.create({
                      id: uuidv4(),
                      name: subsubName,
                      industrySubcategoryId: subcategory.id,
                      createdAt: t4,
                      updatedAt: t4,
                    }, { transaction: tx });
                  }
                  continue;
                }

                // If object has a name but no subsubs, treat the object itself as a leaf
                if (subName) {
                  const t5 = nextTime();
                  await IndustrySubsubCategory.create({
                    id: uuidv4(),
                    name: subName,
                    industrySubcategoryId: subcategory.id,
                    createdAt: t5,
                    updatedAt: t5,
                  }, { transaction: tx });
                  continue;
                }

                // Object without usable name
                console.warn("Skipping subcategory object without name:", sub);
                continue;
              }

              // Unknown shape -> skip
              console.warn("Skipping subcategory with unsupported shape:", sub);
            }
          }
        }
      }
    }

    await tx.commit();
    console.log("✅ Industry categories seeding complete!");
   // process.exit(0);
  } catch (err) {
    await tx.rollback();
    console.error("❌ Error seeding industry categories:", err);
    process.exit(1);
  }
}

seed();
