// src/routes/settings.routes.js
const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settings.controller");
const auth = require("../middleware/auth");

// All routes in this file require authentication
router.use(auth());

// Get user settings
router.get("/", getSettings);

// Update user settings
router.put("/", updateSettings);

module.exports = router;