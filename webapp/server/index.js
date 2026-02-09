require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { initDb } = require("./db/init");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Initialize database ───
initDb();

// ─── Security middleware ───
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles for React
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? false // Same origin in production
    : ["http://localhost:5173", "http://localhost:3000"], // Vite dev server
  credentials: true,
}));

// ─── Rate limiting ───
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per window
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
});

// ─── Body parsing ───
app.use(express.json({ limit: "1mb" }));

// ─── Routes ───
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/data", apiLimiter, require("./routes/data"));

// ─── Health check ───
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Serve React frontend in production ───
if (process.env.NODE_ENV === "production") {
  const clientBuild = path.join(__dirname, "../client/dist");
  app.use(express.static(clientBuild));

  // All non-API routes serve the React app (client-side routing)
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(clientBuild, "index.html"));
    }
  });
}

// ─── Error handler ───
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Greenhouse Monitor API running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);
});
