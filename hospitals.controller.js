const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");
const { rankHospitals } = require("../utils/ranking");

const list = asyncHandler(async (req, res) => {
  const hospitals = await prisma.hospital.findMany({ include: { bedStatus: true } });
  res.json({ hospitals });
});

const detail = asyncHandler(async (req, res) => {
  const hospital = await prisma.hospital.findUnique({
    where: { id: req.params.id },
    include: { bedStatus: true, doctors: true },
  });
  if (!hospital) throw new ApiError(404, "Hospital not found.");
  res.json({ hospital });
});

const searchSchema = z.object({
  specialty: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(20).default(8),
});

/** GET /hospitals/search?specialty=Cardiology&lat=..&lng=..
 *  Returns hospitals ranked exactly like the frontend's local ranking,
 *  but computed server-side against live bed-status rows. */
const search = asyncHandler(async (req, res) => {
  const { specialty, lat, lng, limit } = searchSchema.parse(req.query);

  const hospitals = await prisma.hospital.findMany({ include: { bedStatus: true } });
  const userCoords = lat != null && lng != null ? { lat, lng } : null;
  const ranked = rankHospitals(hospitals, specialty, userCoords).slice(0, limit);

  res.json({ specialty: specialty || null, results: ranked });
});

module.exports = { list, detail, search };
