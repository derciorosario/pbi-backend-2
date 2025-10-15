const express = require("express");
const industryCategoryController = require("../controllers/industryCategory.controller");

const router = express.Router();

// Get industry categories tree
router.get("/tree", industryCategoryController.getIndustryCategoriesTree);

module.exports = router;