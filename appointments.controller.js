const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");

const createSchema = z.object({
  doctorId: z.string().uuid(),
  hospitalId: z.string().uuid(),
  slotId: z.string().uuid(),
  causeSlug: z.string().optional(),
  reasonText: z.string().max(500).optional(),
  patientName: z.string().min(2),
  patientPhone: z.string().min(10),
});

/** POST /appointments
 *  Books a slot transactionally: the slot is locked/marked booked and the
 *  appointment created together, so two people can never double-book the
 *  same slot even under concurrent requests. */
const create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);

  const cause = data.causeSlug
    ? await prisma.causeCategory.findUnique({ where: { slug: data.causeSlug } })
    : null;

  const appointment = await prisma.$transaction(async (tx) => {
    const slot = await tx.doctorSlot.findUnique({ where: { id: data.slotId } });
    if (!slot || slot.doctorId !== data.doctorId) throw new ApiError(404, "Slot not found for this doctor.");
    if (slot.isBooked) throw new ApiError(409, "That slot was just booked by someone else — pick another.");

    await tx.doctorSlot.update({ where: { id: data.slotId }, data: { isBooked: true } });

    return tx.appointment.create({
      data: {
        userId: req.user?.id ?? null,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        slotId: data.slotId,
        causeCategoryId: cause?.id,
        reasonText: data.reasonText,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        status: "REQUESTED",
      },
      include: { doctor: true, hospital: true, slot: true, causeCategory: true },
    });
  }).catch((err) => {
    if (err instanceof ApiError) throw err;
    // Unique constraint on slotId (already has an appointment) races with the check above.
    throw new ApiError(409, "That slot was just booked by someone else — pick another.");
  });

  res.status(201).json({ appointment });
});

const detail = asyncHandler(async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { doctor: true, hospital: true, slot: true, causeCategory: true },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found.");
  res.json({ appointment });
});

const cancel = asyncHandler(async (req, res) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) throw new ApiError(404, "Appointment not found.");

  await prisma.$transaction([
    prisma.appointment.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } }),
    prisma.doctorSlot.update({ where: { id: appointment.slotId }, data: { isBooked: false } }),
  ]);

  res.json({ ok: true });
});

module.exports = { create, detail, cancel };
