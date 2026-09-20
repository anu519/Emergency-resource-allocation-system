const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");
const { getIo } = require("../sockets/registry");

const detail = asyncHandler(async (req, res) => {
  const trip = await prisma.ambulanceTrip.findUnique({
    where: { id: req.params.id },
    include: { hospital: true, positions: { orderBy: { recordedAt: "desc" }, take: 1 } },
  });
  if (!trip) throw new ApiError(404, "Trip not found.");
  res.json({ trip, latestPosition: trip.positions[0] || null });
});

const positionSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

/** POST /trips/:id/position
 *  Used only in "device" tracking mode — a driver's phone/app posts real
 *  GPS points here. Writes to the same AmbulancePosition table and emits
 *  the same `position_update` event the simulator uses, so the frontend
 *  is identical either way. Should be protected by a driver-specific auth
 *  token in production (kept simple here since mode is opt-in via env). */
const postPosition = asyncHandler(async (req, res) => {
  const trip = await prisma.ambulanceTrip.findUnique({ where: { id: req.params.id } });
  if (!trip) throw new ApiError(404, "Trip not found.");
  if (trip.source !== "DEVICE") throw new ApiError(400, "This trip is not in device-tracking mode.");

  const { lat, lng } = positionSchema.parse(req.body);
  const position = await prisma.ambulancePosition.create({ data: { tripId: trip.id, lat, lng } });

  if (trip.status === "DISPATCHED") {
    await prisma.ambulanceTrip.update({ where: { id: trip.id }, data: { status: "ENROUTE" } });
  }

  getIo().to(`trip:${trip.id}`).emit("position_update", {
    tripId: trip.id,
    lat,
    lng,
    progress: null, // unknown for real GPS, frontend can compute from remaining distance if needed
    recordedAt: position.recordedAt,
  });

  res.status(201).json({ position });
});

const markArrived = asyncHandler(async (req, res) => {
  const trip = await prisma.ambulanceTrip.update({
    where: { id: req.params.id },
    data: { status: "ARRIVED", arrivedAt: new Date() },
  });
  getIo().to(`trip:${trip.id}`).emit("trip_arrived", { tripId: trip.id });
  res.json({ trip });
});

module.exports = { detail, postPosition, markArrived };
