const { Server } = require("socket.io");
const { setIo } = require("./registry");

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || "*" },
  });
  setIo(io);

  io.on("connection", (socket) => {
    /* -------- Ambulance tracking -------- */
    // Client calls socket.emit('trip:subscribe', tripId) after calling the
    // ambulance, then listens for 'position_update' / 'trip_arrived'.
    socket.on("trip:subscribe", (tripId) => {
      if (typeof tripId === "string") socket.join(`trip:${tripId}`);
    });
    socket.on("trip:unsubscribe", (tripId) => {
      if (typeof tripId === "string") socket.leave(`trip:${tripId}`);
    });

    /* -------- Doctor messaging (Care Plan chat) -------- */
    socket.on("chat:join", ({ userId, doctorId }) => {
      if (userId && doctorId) socket.join(`chat:${userId}:${doctorId}`);
    });
    socket.on("chat:message", ({ userId, doctorId, sender, text }) => {
      if (!userId || !doctorId || !text) return;
      io.to(`chat:${userId}:${doctorId}`).emit("chat:message", {
        sender,
        text,
        createdAt: new Date().toISOString(),
      });
      // Persisting the message is handled by POST /messages (REST) so the
      // socket path stays a pure real-time broadcast, not a second source
      // of truth for the DB write.
    });

    /* -------- Video consult signaling (WebRTC offer/answer/ICE relay) -------- */
    socket.on("video:join", (roomId) => {
      if (typeof roomId === "string") socket.join(`video:${roomId}`);
    });
    socket.on("video:signal", ({ roomId, signal }) => {
      if (!roomId) return;
      socket.to(`video:${roomId}`).emit("video:signal", { signal, from: socket.id });
    });
    socket.on("video:leave", (roomId) => {
      if (typeof roomId === "string") {
        socket.leave(`video:${roomId}`);
        socket.to(`video:${roomId}`).emit("video:peer-left", { from: socket.id });
      }
    });
  });

  return io;
}

module.exports = { initSockets };
