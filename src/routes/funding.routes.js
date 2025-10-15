const router = require("express").Router();
const C = require("../controllers/funding.controller");
const auth = require("../middleware/auth"); // auth(true) -> requires token
const upload = require("../utils/multerConfig");

// Metadata for form
router.get("/meta", auth(false), C.getMeta);

// Upload images
router.post("/upload-images", auth(true), upload.array('images', 20), C.uploadImages);

// CRUD for funding projects
router.get("/projects", auth(false), C.list);
router.get("/projects/my", auth(true), C.getMyProjects); // Get projects created by the current user
router.get("/projects/:id", auth(false), C.getOne);
router.post("/projects", auth(true), C.create);
router.put("/projects/:id", auth(true), C.update);

module.exports = router;