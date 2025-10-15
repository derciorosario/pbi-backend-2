const express = require("express");
const router = express.Router();
const eventRegistrationController = require("../controllers/eventRegistration.controller");
const auth = require("../middleware/auth");

// Create a new registration
router.post("/", auth(), eventRegistrationController.createRegistration);

// Get user's registrations
router.get("/my-registrations", auth(), eventRegistrationController.getUserRegistrations);

// Get registrations for an event (organizer only)
router.get("/event/:eventId", auth(), eventRegistrationController.getEventRegistrations);

// Update registration status (organizer only)
router.patch("/:registrationId/status", auth(), eventRegistrationController.updateRegistrationStatus);

// Cancel user's own registration
router.patch("/:registrationId/cancel", auth(), eventRegistrationController.cancelRegistration);

module.exports = router;