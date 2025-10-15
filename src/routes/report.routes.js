const router = require("express").Router();
const auth = require("../middleware/auth");
const R = require("../controllers/report.controller");

router.post("/reports", auth(true), R.createReport);

module.exports = router;
