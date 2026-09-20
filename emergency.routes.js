const router = require("express").Router();
const { search, callAmbulance } = require("../controllers/emergency.controller");
const { optionalAuth } = require("../middleware/auth");

router.post("/search", optionalAuth, search);
router.post("/call-ambulance", optionalAuth, callAmbulance);

module.exports = router;
