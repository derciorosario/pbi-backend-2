const router = require("express").Router();
const C = require("../controllers/service.controller");
const auth = require("../middleware/auth"); // auth(true) -> requires token
const upload = require("../utils/multerConfigAttachments");

// Metadata for form
router.get("/meta", auth(false), C.getMeta);

// Upload attachments
router.post("/upload-attachments", auth(true), upload.array('attachments', 20), C.uploadAttachments);

// CRUD
router.get("/", auth(false), C.list);
router.get("/my", auth(true), C.getMyServices); // Get services provided by the current user
router.get("/:id", auth(false), C.getOne);
router.post("/", auth(true), C.create);
router.put("/:id", auth(true), C.update);
router.delete("/:id", auth(true), C.deleteService);

module.exports = router;