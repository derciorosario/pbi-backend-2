// src/routes/profileApplications.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  getJobApplications,
  getEventRegistrations,
} = require("../controllers/profileApplications.controller");

// GET /api/profile/applications/jobs - Get user's job applications with similarity scores
router.get("/applications/jobs", auth(true), getJobApplications);

// GET /api/profile/applications/events - Get user's event registrations with similarity scores
router.get("/applications/events", auth(true), getEventRegistrations);

module.exports = router;