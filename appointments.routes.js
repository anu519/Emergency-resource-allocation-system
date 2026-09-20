const router = require("express").Router();
const { create, detail, cancel } = require("../controllers/appointments.controller");
const { optionalAuth } = require("../middleware/auth");

// optionalAuth: booking works for guests too (matches current frontend demo),
// but attaches the appointment to an account when the user is logged in.
router.post("/", optionalAuth, create);
router.get("/:id", detail);
router.patch("/:id/cancel", cancel);

module.exports = router;
