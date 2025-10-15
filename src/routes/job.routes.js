const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/job.controller");
const upload = require("../utils/multerConfig");

// If you have auth middleware, add it where needed:
const requireAuth = require("../middleware/auth");

router.get("/", ctrl.listJobs);
router.get("/:id", ctrl.getJob);
router.post("/", requireAuth(), ctrl.createJob);
router.put("/:id", requireAuth(), ctrl.updateJob);
router.delete("/:id", requireAuth(), ctrl.deleteJob);

// File upload routes
router.post("/upload-cover", requireAuth(), upload.single('coverImage'), ctrl.uploadCoverImage);
module.exports = router;
