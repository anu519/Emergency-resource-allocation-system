const router = require("express").Router();
const { list } = require("../controllers/causes.controller");

router.get("/", list);

module.exports = router;
