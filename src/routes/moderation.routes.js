// src/routes/moderation.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const M = require("../controllers/moderation.controller");

// Get content for moderation (with pagination and filtering)
router.get("/content", auth(true), M.getContentForModeration);

// Update content moderation status
router.put("/content/:id/status", auth(true), M.updateModerationStatus);

// Get moderation statistics
router.get("/stats", auth(true), M.getModerationStats);

module.exports = router;