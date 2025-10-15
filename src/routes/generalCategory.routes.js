const router = require("express").Router();
const ctrl = require("../controllers/generalCategory.controller");

// GET /api/general-categories/tree?type=job
router.get("/tree", ctrl.getTree);

module.exports = router;
