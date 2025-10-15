const router = require("express").Router();
const auth = require("../middleware/auth");
const C = require("../controllers/connection.controller");

router.post("/connections/requests", auth(true), C.createRequest);
router.get ("/connections/requests", auth(true), C.getMyPending);
router.post("/connections/requests/:id/respond", auth(true), C.respond);
router.delete("/connections/:otherUserId", auth(true), C.removeConnection);
router.get("/connections", auth(true), C.getMyConnections);

module.exports = router;
