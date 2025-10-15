// src/routes/public.routes.js
const router = require("express").Router();
const { Category, Subcategory, Goal } = require("../models");
const auth = require("../middleware/auth"); // auth(true) -> requires token


router.get("/categories", async (req, res) => {
  const cats = await Category.findAll({
    order: [["name","ASC"]],
    include: [{ model: Subcategory, as: "subcategories", attributes: ["id","name"] }],
  });
  res.json(cats.map(c => ({
    id: c.id, name: c.name,
    subcategories: c.subcategories.map(s => ({ id: s.id, name: s.name })),
  })));
});

router.get("/goals", async (req, res) => {
  const goals = await Goal.findAll({ order: [["name","ASC"]] });
  res.json(goals.map(g => ({ id: g.id, name: g.name })));
});

const { getIdentityCatalog } = require("../controllers/public.controller");

router.get("/identities",auth(false),getIdentityCatalog);


module.exports = router;
