const router = require("express").Router();
const ctrl = require("../controllers/category.controller");

router.get("/tree", ctrl.getTree); // GET /api/categories/tree

module.exports = router;
