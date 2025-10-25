const router = require("express").Router();
const { submitSupport, getAllSupports, getSupportById, updateSupportStatus, upload } = require("../controllers/support.controller");

// Public route for support form submission
router.post("/", upload.single("attachment"), submitSupport);

// Admin routes (protected)
router.get("/", getAllSupports);
router.get("/:id", getSupportById);
router.patch("/:id/status", updateSupportStatus);

module.exports = router;