// /seed/seedIdentities.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  sequelize,
  Identity,
  Goal,
  Category,
  Subcategory,
  SubsubCategory,
} = require("../src/models");

const norm = (s) => String(s || "").trim();

// -------- CONFIG: choose what to seed --------
//const sectionsToSeed = ["goals", "identities", "company_identities"];
const sectionsToSeed = ["identities"];

async function findOrCreateCategoryByName(name, identityId = null, type = "individual") {
  const n = norm(name);
  let cat = await Category.findOne({ where: { name: n, identityId, type } });
  if (!cat) cat = await Category.create({ name: n, identityId, type });
  return cat;
}

async function findOrCreateSubcategory(categoryId, name, type = "individual") {
  const n = norm(name);
  let sub = await Subcategory.findOne({ where: { categoryId, name: n, type } });
  if (!sub) sub = await Subcategory.create({ categoryId, name: n, type });
  return sub;
}

async function findOrCreateSubsub(subcategoryId, name, type = "individual") {
  const n = norm(name);
  let ss = await SubsubCategory.findOne({ where: { subcategoryId, name: n, type } });
  if (!ss) ss = await SubsubCategory.create({ subcategoryId, name: n, type });
  return ss;
}

async function seedFromSingleFile() {
  const file = path.join(__dirname, "../seed/identity_category_map.json");
  const dataset = JSON.parse(fs.readFileSync(file, "utf8"));

  // ---- Goals ----
  if (sectionsToSeed.includes("goals")) {
    for (const g of dataset.goals || []) {
      const name = norm(g);
      if (!name) continue;
      await Goal.findOrCreate({ where: { name }, defaults: { name } });
    }
  }

  // ---- Identities (individual type) ----
  if (sectionsToSeed.includes("identities")) {
    for (const identity of dataset.identities || []) {
      const name = norm(identity.name);
      if (!name) continue;

       console.log({name,n:identity.name})

      if(identity.name=="Executives"){

       

          const [identityRow] = await Identity.findOrCreate({
            where: { name },
            defaults: { name, type: "individual" },
          });

          for (const cat of identity.categories || []) {
            const catRow = await findOrCreateCategoryByName(cat.name, identityRow.id, "individual");

            for (const sub of cat.subcategories || []) {
              const subRow = await findOrCreateSubcategory(catRow.id, sub.name, "individual");

              for (const ssName of sub.subsubs || []) {
                await findOrCreateSubsub(subRow.id, ssName, "individual");
              }
            }
          }

      }

    }
  }

  // ---- Company Identities (company type) ----
  if (sectionsToSeed.includes("company_identities")) {
    for (const identity of dataset.company_identities || []) {
      const name = norm(identity.name);
      if (!name) continue;

      const [identityRow] = await Identity.findOrCreate({
        where: { name },
        defaults: { name, type: "company" },
      });

      for (const cat of identity.categories || []) {
        const catRow = await findOrCreateCategoryByName(cat.name, identityRow.id, "company");

        for (const sub of cat.subcategories || []) {
          const subRow = await findOrCreateSubcategory(catRow.id, sub.name, "company");

          for (const ssName of sub.subsubs || []) {
            await findOrCreateSubsub(subRow.id, ssName, "company");
          }
        }
      }
    }
  }

  console.log("✅ Seeding complete for:", sectionsToSeed.join(", "));
}

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true }); // will add new columns if missing
    await seedFromSingleFile();
   // process.exit(0);
  } catch (e) {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  }
})();
