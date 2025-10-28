const router = require("express").Router();
const C = require("../controllers/tourism.controller");
const auth = require("../middleware/auth"); // auth(true) -> requires token
const upload = require("../utils/multerConfig");

// Metadata for form
router.get("/meta", auth(false), C.getMeta);

// Upload images
router.post("/upload-images", auth(true), upload.array('images', 20), C.uploadImages);

// CRUD
router.get("/", auth(false), C.list);
router.get("/my", auth(true), C.getMyPosts); // Get tourism posts created by the current user
router.get("/:id", auth(false), C.getOne);
router.post("/", auth(true), C.create);
router.put("/:id", auth(true), C.update);
router.delete("/:id", auth(true), C.deleteTourism);

module.exports = router;