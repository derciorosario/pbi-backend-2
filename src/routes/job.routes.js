const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/job.controller");
const upload = require("../utils/multerConfig");
const Upload = require("../utils/multerConfigImageAndVideo");

// If you have auth middleware, add it where needed:
const requireAuth = require("../middleware/auth");

router.get("/", ctrl.listJobs);
router.get("/:id", ctrl.getJob);
router.post("/", requireAuth(), ctrl.createJob);
router.put("/:id", requireAuth(), ctrl.updateJob);
router.delete("/:id", requireAuth(), ctrl.deleteJob);

// File upload routes
router.post("/upload-cover", requireAuth(), Upload.uploadCover, ctrl.uploadCoverImage);
router.post("/upload-video", requireAuth(), Upload.uploadVideo, ctrl.uploadCoverImage);
module.exports = router;
