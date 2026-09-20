let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  if (!ioInstance) throw new Error("Socket.io not initialized yet — setIo() must run before any emit.");
  return ioInstance;
}

module.exports = { setIo, getIo };
