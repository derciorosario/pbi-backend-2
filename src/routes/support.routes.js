const router = require("express").Router();
const { submitSupport, getAllSupports, getSupportById, updateSupportStatus, markSupportAsRead, markAllSupportsAsRead, getUnreadSupportsCount, upload } = require("../controllers/support.controller");

// Public route for support form submission
router.post("/", upload.single("attachment"), submitSupport);

// Admin routes (protected)
router.get("/", getAllSupports);
router.get("/:id", getSupportById);
router.patch("/:id/status", updateSupportStatus);
router.patch("/:id/read", markSupportAsRead);
router.patch("/read-all", markAllSupportsAsRead);
router.get("/unread/count", getUnreadSupportsCount);

module.exports = router;