const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/need.controller");

// If you have auth middleware, add it where needed:
const requireAuth = require("../middleware/auth");
const upload = require("../utils/multerConfig");

// Upload attachments
router.post("/upload-attachments", requireAuth(), upload.array('attachments', 10), ctrl.uploadAttachments);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", requireAuth(), ctrl.create);
router.put("/:id", requireAuth(), ctrl.update);
router.delete("/:id", requireAuth(), ctrl.delete);

module.exports = router;