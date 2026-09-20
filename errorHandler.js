/** Catches errors thrown/passed from any route and returns a consistent
 *  JSON shape instead of leaking stack traces to the client. */
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.expose ? err.message : "Something went wrong. Please try again.";
  res.status(status).json({ error: message });
}

/** Wraps an async route handler so thrown errors reach errorHandler
 *  instead of crashing the process. Avoids try/catch boilerplate in
 *  every controller. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = { errorHandler, asyncHandler, ApiError };
