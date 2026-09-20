const prisma = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

/** GET /causes — powers the "what's the reason for your visit" icon grid
 *  in the booking flow. `icon` is a string key (e.g. "bone", "brain") that
 *  the frontend maps to its own lucide-react icon component, so backend
 *  never needs to know about the UI library. */
const list = asyncHandler(async (req, res) => {
  const causes = await prisma.causeCategory.findMany({ orderBy: { sortOrder: "asc" } });
  res.json({ causes });
});

module.exports = { list };
