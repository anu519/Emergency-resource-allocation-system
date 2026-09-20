const prisma = require("../config/db");
const { getIo } = require("../sockets/registry");

// tripId -> setInterval handle, so we can stop it on arrival/cancel and
// never run two simulators for the same trip.
const runningTrips = new Map();

const TICK_MS = 2500;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Starts (or safely no-ops if already running) the interpolation loop for
 *  one simulated trip. Every tick: compute progress from elapsed time vs
 *  etaMinutes, write an AmbulancePosition row, and emit it to anyone
 *  subscribed to `trip:{id}` — this is the exact same event shape a real
 *  driver-device feed would produce, so the frontend never has to branch
 *  on tracking source. */
async function startSimulatedTrip(tripId) {
  if (runningTrips.has(tripId)) return;

  const trip = await prisma.ambulanceTrip.findUnique({ where: { id: tripId } });
  if (!trip || trip.source !== "SIMULATED") return;

  const startedAtMs = trip.startedAt.getTime();
  const etaMs = trip.etaMinutes * 60 * 1000;

  const handle = setInterval(async () => {
    const elapsed = Date.now() - startedAtMs;
    const progress = Math.min(1, elapsed / etaMs);

    const lat = lerp(trip.originLat, trip.destLat, progress);
    const lng = lerp(trip.originLng, trip.destLng, progress);

    const position = await prisma.ambulancePosition.create({
      data: { tripId, lat, lng },
    });

    try {
      getIo().to(`trip:${tripId}`).emit("position_update", {
        tripId,
        lat,
        lng,
        progress,
        recordedAt: position.recordedAt,
      });
    } catch (e) {
      // io not ready yet (e.g. during tests) — position is still persisted.
    }

    if (progress >= 1) {
      await prisma.ambulanceTrip.update({
        where: { id: tripId },
        data: { status: "ARRIVED", arrivedAt: new Date() },
      });
      try {
        getIo().to(`trip:${tripId}`).emit("trip_arrived", { tripId });
      } catch (e) {}
      stopSimulatedTrip(tripId);
      return;
    }

    if (progress > 0 && trip.status !== "ENROUTE") {
      await prisma.ambulanceTrip.update({ where: { id: tripId }, data: { status: "ENROUTE" } });
      trip.status = "ENROUTE";
    }
  }, TICK_MS);

  runningTrips.set(tripId, handle);
}

function stopSimulatedTrip(tripId) {
  const handle = runningTrips.get(tripId);
  if (handle) {
    clearInterval(handle);
    runningTrips.delete(tripId);
  }
}

/** Called on server boot to resume any trip that was mid-flight when the
 *  process last restarted (e.g. a deploy), instead of leaving it frozen. */
async function resumeInFlightTrips() {
  const active = await prisma.ambulanceTrip.findMany({
    where: { source: "SIMULATED", status: { in: ["DISPATCHED", "ENROUTE"] } },
  });
  active.forEach((t) => startSimulatedTrip(t.id));
}

module.exports = { startSimulatedTrip, stopSimulatedTrip, resumeInFlightTrips };
