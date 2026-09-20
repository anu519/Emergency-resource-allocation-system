const router = require("express").Router();
const { list, detail, slots } = require("../controllers/doctors.controller");

router.get("/:id/slots", slots); // must come before /:id
router.get("/:id", detail);
router.get("/", list);

module.exports = router;
