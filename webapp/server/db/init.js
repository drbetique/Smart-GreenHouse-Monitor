const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "greenhouse.db");

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin', 'operator', 'viewer')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alert_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_key TEXT NOT NULL,
      min_value REAL,
      max_value REAL,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_key TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      value REAL NOT NULL,
      threshold REAL NOT NULL,
      triggered_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_alert_history_time ON alert_history(triggered_at);
  `);

  // Insert default alert configs if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM alert_configs").get();
  if (count.c === 0) {
    const insert = db.prepare("INSERT INTO alert_configs (sensor_key, min_value, max_value, enabled) VALUES (?, ?, ?, 1)");
    const defaults = [
      ["co2", 300, 1000],
      ["temperature", 14, 32],
      ["humidity", 35, 85],
      ["light", 0, 35000],
      ["soil_moisture", 20, 75],
    ];
    const tx = db.transaction(() => {
      defaults.forEach(([key, min, max]) => insert.run(key, min, max));
    });
    tx();
  }

  db.close();
  console.log("[DB] Initialized at", DB_PATH);
}

module.exports = { getDb, initDb, DB_PATH };
