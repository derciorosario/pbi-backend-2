const express = require("express");
const router = express.Router();
const { searchPeople } = require("../controllers/people.controller");
const auth = require("../middleware/auth");

// auth(true) = opcional: usa req.user se houver token
router.get("/", auth(false), searchPeople);

module.exports = router;
