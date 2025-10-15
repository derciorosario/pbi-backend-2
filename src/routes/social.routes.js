const router = require("express").Router();
const auth = require("../middleware/auth");
const S = require("../controllers/social.controller");

// Like routes
router.post("/likes", auth(true), S.toggleLike);
router.get("/likes/:targetType/:targetId", auth(false), S.getLikeStatus);

// Comment routes
router.post("/comments", auth(true), S.createComment);
router.get("/comments/:targetType/:targetId", S.getComments);
router.put("/comments/:id", auth(true), S.updateComment);
router.delete("/comments/:id", auth(true), S.deleteComment);

// Repost routes
router.post("/reposts", auth(true), S.createRepost);
router.get("/reposts/:targetType/:targetId", S.getReposts);
router.delete("/reposts/:id", auth(true), S.deleteRepost);

module.exports = router;