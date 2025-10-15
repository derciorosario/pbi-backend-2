const router = require("express").Router();
const auth = require("../middleware/auth");
const B = require("../controllers/block.controller");

router.post  ("/users/:otherUserId/block",   auth(true), B.blockUser);
router.delete("/users/:otherUserId/block",   auth(true), B.unblockUser);
router.get   ("/blocks",                     auth(true), B.getMyBlocks);

module.exports = router;
