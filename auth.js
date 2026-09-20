const jwt = require("jsonwebtoken");

/** Requires a valid Bearer token. Attaches { id, phone } to req.user. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Attaches req.user if a valid token is present, but never blocks the
 *  request. Used on routes like emergency search that work for guests
 *  too, but personalize/log against an account when logged in. */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // ignore bad token on optional routes
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
