const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");

const listSchema = z.object({
  specialty: z.string().optional(),
  hospitalId: z.string().uuid().optional(),
  causeSlug: z.string().optional(), // e.g. "knee-pain" -> resolves to a specialty
});

/** GET /doctors?specialty=&hospitalId=&causeSlug=
 *  This is the endpoint the "pick a cause" booking screen calls: pass the
 *  cause slug (e.g. "kidney-stone") and get back every doctor who treats
 *  it, each with their hospital attached, so the UI can group by hospital
 *  and show name + role + experience under it. */
const list = asyncHandler(async (req, res) => {
  const q = listSchema.parse(req.query);

  let specialty = q.specialty;
  if (q.causeSlug) {
    const cause = await prisma.causeCategory.findUnique({ where: { slug: q.causeSlug } });
    if (!cause) throw new ApiError(404, "Unknown cause category.");
    specialty = cause.specialty;
  }

  const doctors = await prisma.doctor.findMany({
    where: {
      ...(specialty ? { specialty } : {}),
      ...(q.hospitalId ? { hospitalId: q.hospitalId } : {}),
    },
    include: { hospital: true },
    orderBy: { rating: "desc" },
  });

  res.json({ specialty: specialty || null, doctors });
});

const detail = asyncHandler(async (req, res) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params.id },
    include: { hospital: true },
  });
  if (!doctor) throw new ApiError(404, "Doctor not found.");
  res.json({ doctor });
});

/** GET /doctors/:id/slots — only *open* slots in the future. */
const slots = asyncHandler(async (req, res) => {
  const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id } });
  if (!doctor) throw new ApiError(404, "Doctor not found.");

  const slots = await prisma.doctorSlot.findMany({
    where: { doctorId: req.params.id, isBooked: false, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
  });
  res.json({ doctorId: req.params.id, slots });
});

module.exports = { list, detail, slots };
