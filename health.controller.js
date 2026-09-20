const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");

const vitalsSchema = z.object({
  bp: z.string().optional(),
  sugar: z.number().optional(),
  weightKg: z.number().optional(),
});

const listVitals = asyncHandler(async (req, res) => {
  const vitals = await prisma.vitalsLog.findMany({
    where: { userId: req.user.id },
    orderBy: { recordedAt: "asc" },
  });
  res.json({ vitals });
});

const addVital = asyncHandler(async (req, res) => {
  const data = vitalsSchema.parse(req.body);
  if (!data.bp && data.sugar == null && data.weightKg == null) {
    throw new ApiError(400, "Provide at least one reading (BP, sugar, or weight).");
  }
  const vital = await prisma.vitalsLog.create({ data: { userId: req.user.id, ...data } });
  res.status(201).json({ vital });
});

const listPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await prisma.prescription.findMany({
    where: { userId: req.user.id },
    include: { doctor: true },
    orderBy: { refillDueAt: "asc" },
  });
  res.json({ prescriptions });
});

const requestRefill = asyncHandler(async (req, res) => {
  const prescription = await prisma.prescription.findUnique({ where: { id: req.params.id } });
  if (!prescription || prescription.userId !== req.user.id) throw new ApiError(404, "Prescription not found.");

  // In production this would notify a pharmacy integration; for now it
  // just timestamps the request so the UI can show "refill sent".
  const updated = await prisma.prescription.update({
    where: { id: req.params.id },
    data: { lastRefillAt: new Date() },
  });
  res.json({ prescription: updated });
});

module.exports = { listVitals, addVital, listPrescriptions, requestRefill };
