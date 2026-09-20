const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");
const { rankHospitals } = require("../utils/ranking");
const { detectSpecialty, detectSeverity } = require("../utils/symptom");
const { startSimulatedTrip } = require("../jobs/ambulanceSimulator");

const searchSchema = z.object({
  symptomText: z.string().min(2),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

/** POST /emergency/search
 *  Same job as the frontend's local detectSpecialty()/rankHospitals() combo,
 *  but centralized here so quick-tap buttons and free-text search both hit
 *  one place, and every search is logged for later triage/analytics. */
const search = asyncHandler(async (req, res) => {
  const data = searchSchema.parse(req.body);
  const detected = detectSpecialty(data.symptomText);
  const isCritical = detectSeverity(data.symptomText);

  const emergencyRequest = await prisma.emergencyRequest.create({
    data: {
      userId: req.user?.id ?? null,
      symptomText: data.symptomText,
      detectedSpecialty: detected.specialty,
      isCritical,
      userLat: data.lat,
      userLng: data.lng,
    },
  });

  const hospitals = await prisma.hospital.findMany({ include: { bedStatus: true } });
  const userCoords = data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null;
  const ranked = rankHospitals(hospitals, detected.specialty, userCoords).slice(0, 8);

  res.json({
    emergencyRequestId: emergencyRequest.id,
    detected,
    isCritical,
    results: ranked,
  });
});

const callAmbulanceSchema = z.object({
  emergencyRequestId: z.string().uuid().optional(),
  hospitalId: z.string().uuid(),
  patientLat: z.number(),
  patientLng: z.number(),
});

/** POST /emergency/call-ambulance
 *  Creates the trip record and — in simulated mode — immediately starts
 *  the interpolation engine so the frontend map has something to render
 *  within the first tick. In device mode this just creates the trip and
 *  waits for the driver app to start posting real positions. */
const callAmbulance = asyncHandler(async (req, res) => {
  const data = callAmbulanceSchema.parse(req.body);

  const hospital = await prisma.hospital.findUnique({ where: { id: data.hospitalId } });
  if (!hospital) throw new ApiError(404, "Hospital not found.");

  const { rankHospitals: _r } = require("../utils/ranking");
  const distKm = require("../utils/ranking").haversineKm(hospital.lat, hospital.lng, data.patientLat, data.patientLng);
  const etaMinutes = Math.max(4, Math.round(distKm * 3));

  const mode = (process.env.AMBULANCE_TRACKING_MODE || "simulated").toUpperCase();

  const trip = await prisma.ambulanceTrip.create({
    data: {
      emergencyRequestId: data.emergencyRequestId,
      hospitalId: hospital.id,
      status: "DISPATCHED",
      source: mode === "DEVICE" ? "DEVICE" : "SIMULATED",
      originLat: hospital.lat,
      originLng: hospital.lng,
      destLat: data.patientLat,
      destLng: data.patientLng,
      etaMinutes,
    },
  });

  if (trip.source === "SIMULATED") startSimulatedTrip(trip.id);

  res.status(201).json({ trip });
});

module.exports = { search, callAmbulance };
