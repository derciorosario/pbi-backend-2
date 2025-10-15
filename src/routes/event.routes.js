const router = require("express").Router();
const C = require("../controllers/event.controller");
const auth = require("../middleware/auth"); // auth(true) -> requires token
const upload = require("../utils/multerConfig");

// Metadata for form
router.get("/meta", auth(false), C.getMeta);

// CRUD
router.get("/", auth(false), C.list);
router.get("/:id", auth(false), C.getOne);
router.post("/", auth(true), C.create);
router.put("/:id", auth(true), C.update);
router.delete("/:id", auth(true), C.deleteEvent);

// File upload routes
router.post("/upload-cover", auth(true), upload.single('coverImage'), C.uploadCoverImage);

module.exports = router;
