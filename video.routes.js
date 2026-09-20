const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { start, end } = require("../controllers/video.controller");

router.post("/start", requireAuth, start);
router.patch("/:id/end", requireAuth, end);

module.exports = router;
