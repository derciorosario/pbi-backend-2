const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const meetingRequestController = require("../controllers/meetingRequest.controller");

// Create a new meeting request
router.post("/", auth(true),meetingRequestController.createMeetingRequest);

// Get meeting requests for current user
router.get("/", auth(true),meetingRequestController.getMeetingRequests);

// Get upcoming accepted meetings
router.get("/upcoming", auth(true),meetingRequestController.getUpcomingMeetings);

// Get a specific meeting request
router.get("/:id",auth(true), meetingRequestController.getMeetingRequest);

// Respond to a meeting request (accept/reject)
router.post("/:id/respond",auth(true), meetingRequestController.respondToMeetingRequest);

// Cancel a meeting request
router.post("/:id/cancel", auth(true), meetingRequestController.cancelMeetingRequest);

module.exports = router;