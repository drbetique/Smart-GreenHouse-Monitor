const jwt = require("jsonwebtoken");
const { getDb } = require("../db/init");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Verify JWT token and attach user to request
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, SECRET);
    const db = getDb();
    const user = db.prepare("SELECT id, email, name, role, active FROM users WHERE id = ?").get(payload.userId);
    db.close();

    if (!user || !user.active) {
      return res.status(401).json({ error: "Account disabled or not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Role-based access: pass allowed roles as arguments
// Usage: authorize("admin", "operator")
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions", required: roles, current: req.user.role });
    }
    next();
  };
}

function generateToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "24h" });
}

module.exports = { authenticate, authorize, generateToken };
