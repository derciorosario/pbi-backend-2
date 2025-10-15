const router = require("express").Router();
const { submitContact, getAllContacts, getContactById, updateContactStatus, upload } = require("../controllers/contact.controller");

// Public route for contact form submission
router.post("/", upload.single("attachment"), submitContact);

// Admin routes (protected)
router.get("/", getAllContacts);
router.get("/:id", getContactById);
router.patch("/:id/status", updateContactStatus);

module.exports = router;