const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { subscribe, me } = require("../controllers/carePlans.controller");
const { listVitals, addVital, listPrescriptions, requestRefill } = require("../controllers/health.controller");

router.post("/subscribe", requireAuth, subscribe);
router.get("/me", requireAuth, me);

router.get("/vitals", requireAuth, listVitals);
router.post("/vitals", requireAuth, addVital);

router.get("/prescriptions", requireAuth, listPrescriptions);
router.post("/prescriptions/:id/refill", requireAuth, requestRefill);

module.exports = router;
