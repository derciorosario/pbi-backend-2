
const express = require('express')
const router = express.Router();
const C = require("../controllers/user.controller");
const auth = require("../middleware/auth");

// Public profile (optional auth: doesn't block visitors)
router.get("/users/:id/public", auth(false), C.getPublicProfile);

// Search users (requires authentication)
router.get("/users/search", auth(), C.searchUsers);

router.get("/companies", auth(), C.listCompanies);

module.exports = router;
