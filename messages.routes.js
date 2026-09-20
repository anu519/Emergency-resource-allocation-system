const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { history, send } = require("../controllers/messages.controller");

router.get("/:doctorId", requireAuth, history);
router.post("/", requireAuth, send);

module.exports = router;
