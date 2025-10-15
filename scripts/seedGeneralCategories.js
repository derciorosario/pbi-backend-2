// scripts/seedGeneralCategories.js
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  sequelize,
  GeneralCategory,
  GeneralSubcategory,
  GeneralSubsubCategory,
} = require("../src/models"); // adjust path if needed

/**
 * This seeder preserves JSON order WITHOUT adding new columns.
 * It does so by setting createdAt/updatedAt in strictly increasing order.
 * Read with ORDER BY createdAt ASC to get the exact same sequence.
 *
 * Optional: pass --reset to truncate existing data before seeding.
 *    node scripts/seedGeneralCategories.js --reset
 */

async function seed() {
  const categoriesPath = path.join(__dirname, "../seed/generalCategories.json");
  const types = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));

  const tx = await sequelize.transaction();
  try {
    // Optional reset
    if (process.argv.includes("--reset")) {
      await GeneralSubsubCategory.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
      await GeneralSubcategory.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
      await GeneralCategory.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
    }

    // Base time for deterministic ordering
    const base = Date.now();
    let tick = 0; // increments by 1 second per record to keep global ordering
    const nextTime = () => new Date(base + 1000 * (tick++));

    const onlyTheseTypes=['job']

    for (const t of types) {
      if (!t?.categories?.length  || (onlyTheseTypes.length && !onlyTheseTypes.includes(t.type))) continue;

      console.log({a:t.type,b:onlyTheseTypes.includes(t.type)})
     
      // Categories in the same order as in JSON
      for (const cat of t.categories) {
        if (!cat?.name) continue;

        const catTime = nextTime();
        const category = await GeneralCategory.create({
          id: uuidv4(),
          name: cat.name,
          type: t.type,            // e.g., "event" | "product" | "service" | "tourism" | "opportunity"
          createdAt: catTime,
          updatedAt: catTime,
        }, { transaction: tx });

        // Subcategories in the same order as in JSON
        if (Array.isArray(cat.subcategories)) {
          for (const sub of cat.subcategories) {
            // string subcategory
            if (typeof sub === "string") {
              const subTime = nextTime();
              await GeneralSubcategory.create({
                id: uuidv4(),
                name: sub,
                generalCategoryId: category.id,
                createdAt: subTime,
                updatedAt: subTime,
              }, { transaction: tx });
              continue;
            }

            // object subcategory (may contain subsubcategories)
            if (sub && typeof sub === "object" && sub.name) {
              const sTime = nextTime();
              const subcategory = await GeneralSubcategory.create({
                id: uuidv4(),
                name: sub.name,
                generalCategoryId: category.id,
                createdAt: sTime,
                updatedAt: sTime,
              }, { transaction: tx });

              // Sub-subcategories in the same order as in JSON
              if (Array.isArray(sub.subsubcategories) && sub.subsubcategories.length) {
                for (const subsub of sub.subsubcategories) {
                  if (!subsub) continue;
                  const ssTime = nextTime();
                  await GeneralSubsubCategory.create({
                    id: uuidv4(),
                    name: subsub,
                    generalSubcategoryId: subcategory.id,
                    createdAt: ssTime,
                    updatedAt: ssTime,
                  }, { transaction: tx });
                }
              }
              continue;
            }

            if (typeof sub === "object" && !sub?.name) {
              console.warn("Skipping subcategory object without name:", sub);
            }
          }
        }
      }
    }

    await tx.commit();
    console.log("✅ Seeding complete for generals!");
    //process.exit(0);
  } catch (err) {
    await tx.rollback();
    console.error("❌ Error seeding:", err);
    process.exit(1);
  }
}

seed();
