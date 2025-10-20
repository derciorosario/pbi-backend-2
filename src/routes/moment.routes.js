const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/moment.controller");

// If you have auth middleware, add it where needed:
const  requireAuth  = require("../middleware/auth");
const upload = require("../utils/multerConfig");
const uploadMedia = require("../utils/multerConfigAllMediaAttachments");

// Upload images
router.post("/upload-images", requireAuth(), upload.array('images', 10), ctrl.uploadImages);
router.post("/upload-media", requireAuth(), uploadMedia.array('media', 10), ctrl.uploadMedia);

router.get("/", ctrl.listMoments);
router.get("/:id", ctrl.getMoment);
router.post("/", requireAuth(), ctrl.createMoment);
router.put("/:id", requireAuth(), ctrl.updateMoment);
router.delete("/:id", requireAuth(), ctrl.deleteMoment);

module.exports = router;