require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");

const { errorHandler } = require("./middleware/errorHandler");
const { initSockets } = require("./sockets");
const { resumeInFlightTrips } = require("./jobs/ambulanceSimulator");

const authRoutes = require("./routes/auth.routes");
const hospitalsRoutes = require("./routes/hospitals.routes");
const doctorsRoutes = require("./routes/doctors.routes");
const causesRoutes = require("./routes/causes.routes");
const appointmentsRoutes = require("./routes/appointments.routes");
const emergencyRoutes = require("./routes/emergency.routes");
const tripsRoutes = require("./routes/trips.routes");
const carePlansRoutes = require("./routes/carePlans.routes");
const messagesRoutes = require("./routes/messages.routes");
const videoRoutes = require("./routes/video.routes");

const app = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, service: "uyir-care-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalsRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/causes", causesRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/care-plans", carePlansRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/video", videoRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

// Socket.io must be attached to the same httpServer as Express so both
// share one port — simplest deploy story, and it's what the ambulance
// tracking + chat + video signaling all depend on.
initSockets(httpServer);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, async () => {
  console.log(`Uyir Care backend listening on port ${PORT}`);
  await resumeInFlightTrips();
});
