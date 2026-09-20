const router = require("express").Router();
const { list, detail, search } = require("../controllers/hospitals.controller");

router.get("/search", search); // must come before /:id
router.get("/:id", detail);
router.get("/", list);

module.exports = router;
