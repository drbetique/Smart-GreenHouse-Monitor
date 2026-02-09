const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db/init");
const { authenticate, authorize, generateToken } = require("../middleware/auth");

const router = express.Router();

// ─── POST /api/auth/login ───
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());

  if (!user) {
    db.close();
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.active) {
    db.close();
    return res.status(403).json({ error: "Account disabled. Contact administrator." });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    db.close();
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Update last login
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  db.close();

  const token = generateToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// Signup removed. Only admins create users via POST /api/auth/users/create

// ─── GET /api/auth/me ───
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── PUT /api/auth/password ───
router.put("/password", authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const db = getDb();
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    db.close();
    return res.status(401).json({ error: "Current password incorrect" });
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);
  db.close();

  res.json({ message: "Password updated" });
});

// ══════════════════════════════════════════
// ADMIN: User management
// ══════════════════════════════════════════

// ─── GET /api/auth/users ─── (admin only)
router.get("/users", authenticate, authorize("admin"), (req, res) => {
  const db = getDb();
  const users = db.prepare(
    "SELECT id, email, name, role, active, created_at, last_login FROM users ORDER BY created_at DESC"
  ).all();
  db.close();
  res.json({ users });
});

// ─── PUT /api/auth/users/:id/role ─── (admin only)
router.put("/users/:id/role", authenticate, authorize("admin"), (req, res) => {
  const { role } = req.body;
  const userId = parseInt(req.params.id);

  if (!["admin", "operator", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Role must be admin, operator, or viewer" });
  }

  // Prevent self-demotion
  if (userId === req.user.id && role !== "admin") {
    return res.status(400).json({ error: "You cannot change your own admin role" });
  }

  const db = getDb();
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!target) {
    db.close();
    return res.status(404).json({ error: "User not found" });
  }

  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, userId);
  const updated = db.prepare("SELECT id, email, name, role, active FROM users WHERE id = ?").get(userId);
  db.close();

  res.json({ user: updated });
});

// ─── PUT /api/auth/users/:id/status ─── (admin only: enable/disable)
router.put("/users/:id/status", authenticate, authorize("admin"), (req, res) => {
  const { active } = req.body;
  const userId = parseInt(req.params.id);

  if (userId === req.user.id) {
    return res.status(400).json({ error: "You cannot disable your own account" });
  }

  const db = getDb();
  db.prepare("UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?").run(active ? 1 : 0, userId);
  const updated = db.prepare("SELECT id, email, name, role, active FROM users WHERE id = ?").get(userId);
  db.close();

  res.json({ user: updated });
});

// ─── DELETE /api/auth/users/:id ─── (admin only)
router.delete("/users/:id", authenticate, authorize("admin"), (req, res) => {
  const userId = parseInt(req.params.id);

  if (userId === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const db = getDb();
  const target = db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId);
  if (!target) {
    db.close();
    return res.status(404).json({ error: "User not found" });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  db.close();

  res.json({ message: "User deleted", email: target.email });
});

// ─── POST /api/auth/users/create ─── (admin creates user with specific role)
router.post("/users/create", authenticate, authorize("admin"), (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name required" });
  }
  if (!["admin", "operator", "viewer"].includes(role || "viewer")) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    db.close();
    return res.status(409).json({ error: "Email already registered" });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run(email.toLowerCase().trim(), hash, name.trim(), role || "viewer");

  const user = db.prepare("SELECT id, email, name, role, active, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);
  db.close();

  res.status(201).json({ user });
});

module.exports = router;
