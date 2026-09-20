const router = require("express").Router();
const { detail, postPosition, markArrived } = require("../controllers/trips.controller");

router.get("/:id", detail);
router.post("/:id/position", postPosition); // device mode only
router.patch("/:id/arrived", markArrived);

module.exports = router;
