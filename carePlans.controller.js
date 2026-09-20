const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");

const subscribeSchema = z.object({
  planType: z.enum(["BASIC", "CARE_PLUS", "PREMIUM"]),
  assignedDoctorId: z.string().uuid().optional(),
});

const subscribe = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Log in to start a Care Plan.");
  const data = subscribeSchema.parse(req.body);

  // Auto-assign a General Medicine doctor if none picked, mirroring the
  // frontend's current "assignedDoctor" fallback behaviour.
  let doctorId = data.assignedDoctorId;
  if (!doctorId) {
    const fallback = await prisma.doctor.findFirst({ where: { specialty: "General Medicine" } });
    doctorId = fallback?.id;
  }

  const subscription = await prisma.carePlanSubscription.upsert({
    where: { userId: req.user.id },
    update: { planType: data.planType, assignedDoctorId: doctorId, status: "ACTIVE" },
    create: { userId: req.user.id, planType: data.planType, assignedDoctorId: doctorId, status: "ACTIVE" },
    include: { assignedDoctor: { include: { hospital: true } } },
  });

  res.status(201).json({ subscription });
});

const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Log in to view your Care Plan.");
  const subscription = await prisma.carePlanSubscription.findUnique({
    where: { userId: req.user.id },
    include: { assignedDoctor: { include: { hospital: true } } },
  });
  res.json({ subscription });
});

module.exports = { subscribe, me };
