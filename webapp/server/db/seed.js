require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getDb, initDb } = require("./init");

initDb();

const db = getDb();
const email = process.env.ADMIN_EMAIL || "admin@greenhouse.local";
const password = process.env.ADMIN_PASSWORD || "admin123";
const name = "Admin";

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existing) {
  console.log("[SEED] Admin user already exists:", email);
} else {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')").run(email, hash, name);
  console.log("[SEED] Created admin user:", email);
}

db.close();
