const express = require("express");
const { saveOneShot } = require("../controllers/onboardingOneShot.controller");
const router = express.Router();
const auth = require("../middleware/auth");
router.post("/oneshot",auth(true), saveOneShot);

module.exports = router;
