require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { sequelize, Category, Subcategory, Goal } = require("../src/models");

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

     // goals
    const goals = JSON.parse(fs.readFileSync(path.join(__dirname, "goals.json")));

for (const g of goals) {
  try {
    const cleanGoal = g.trim().replace(/\s+/g, " ");
    await Goal.create({ name: cleanGoal });
  } catch (err) {
    console.error(`Erro ao criar goal "${g}":`, err.message);
  }
}


/*
  
    // categories
  const cats = JSON.parse(fs.readFileSync(path.join(__dirname, "categories.full.json")));

  for (const [cat, subs] of Object.entries(cats)) {
    try {
      const cleanCat = cat.trim().replace(/\s+/g, " ");
      const c = await Category.create({ name: cleanCat });

      for (const s of subs) {
        try {
          const cleanSub = s.trim().replace(/\s+/g, " ");
          await Subcategory.create({ categoryId: c.id, name: cleanSub });
        } catch (err) {
          console.error(`Erro ao criar subcategoria "${s}" da categoria "${cat}":`, err.message);
        }
      }
    } catch (err) {
      console.error(`Erro ao criar categoria "${cat}":`, err.message);
    }
  }


   

    console.log("✅ Seeded categories, subcategories, goals");
    process.exit(0);
    */
  } catch (e) { console.error(e); process.exit(1); }
})();
