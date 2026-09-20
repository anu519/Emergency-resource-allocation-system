const { z } = require("zod");
const crypto = require("crypto");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");

const startSchema = z.object({ appointmentId: z.string().uuid() });

/** POST /video/start
 *  Creates (or returns the existing) video room for an appointment. The
 *  actual media stream is peer-to-peer WebRTC between the two clients;
 *  this backend's job is just issuing a shared roomId and relaying
 *  signaling messages over Socket.io (see sockets/index.js `video:*`). */
const start = asyncHandler(async (req, res) => {
  const data = startSchema.parse(req.body);

  const appointment = await prisma.appointment.findUnique({ where: { id: data.appointmentId } });
  if (!appointment) throw new ApiError(404, "Appointment not found.");

  const consult = await prisma.videoConsult.upsert({
    where: { appointmentId: data.appointmentId },
    update: { status: "ACTIVE", startedAt: new Date() },
    create: {
      appointmentId: data.appointmentId,
      roomId: crypto.randomUUID(),
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  res.json({ consult });
});

const end = asyncHandler(async (req, res) => {
  const consult = await prisma.videoConsult.update({
    where: { id: req.params.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  res.json({ consult });
});

module.exports = { start, end };
