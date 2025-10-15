const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/moment.controller");

// If you have auth middleware, add it where needed:
const  requireAuth  = require("../middleware/auth");
const upload = require("../utils/multerConfig");

// Upload images
router.post("/upload-images", requireAuth(), upload.array('images', 10), ctrl.uploadImages);

router.get("/", ctrl.listMoments);
router.get("/:id", ctrl.getMoment);
router.post("/", requireAuth(), ctrl.createMoment);
router.put("/:id", requireAuth(), ctrl.updateMoment);
router.delete("/:id", requireAuth(), ctrl.deleteMoment);

module.exports = router;