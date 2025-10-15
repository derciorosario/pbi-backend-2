const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/jobApplication.controller");

const requireAuth = require("../middleware/auth");

router.post("/", requireAuth(), ctrl.createApplication);
router.get("/my", requireAuth(), ctrl.getMyApplications);
router.get("/job/:jobId", requireAuth(), ctrl.getApplicationsForJob);
router.put("/:id/status", requireAuth(), ctrl.updateApplicationStatus);

module.exports = router;