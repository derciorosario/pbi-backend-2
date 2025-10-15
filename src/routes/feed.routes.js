// src/routes/feed.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth"); // auth(true) => optional
const C = require("../controllers/feed.controller");

router.get("/feed/meta", auth(false), C.getMeta);
router.get("/feed", auth(false), C.getFeed);
router.get("/feed/suggestions", auth(false), C.getSuggestions);
router.get("/users/:userId/items", auth(false), C.getUserItems);

module.exports = router;
