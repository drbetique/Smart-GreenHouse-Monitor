const express = require("express");
const { InfluxDB } = require("@influxdata/influxdb-client");
const { authenticate, authorize } = require("../middleware/auth");
const { getDb } = require("../db/init");

const router = express.Router();

// All data routes require authentication
router.use(authenticate);

// InfluxDB client setup
function getInflux() {
  return new InfluxDB({
    url: process.env.INFLUX_URL || "http://localhost:8086",
    token: process.env.INFLUX_TOKEN,
  });
}

const org = process.env.INFLUX_ORG || "hamk-thesis";
const bucket = process.env.INFLUX_BUCKET || "greenhouse";

// ─── GET /api/data/sensors ───
// Query sensor data within a time range
// Params: start (ISO), end (ISO), sensor (optional: co2,temperature,etc)
router.get("/sensors", async (req, res) => {
  try {
    const { start, end, sensor, aggregate } = req.query;
    const startTime = start || "-24h";
    const endTime = end ? `time(v: "${end}")` : "now()";

    // Build Flux query
    let fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${start ? `time(v: "${start}")` : "-24h"}${end ? `, stop: time(v: "${end}")` : ""})
        |> filter(fn: (r) => r._measurement == "mqtt_consumer")
        |> filter(fn: (r) => r.topic == "greenhouse/lepaa/sensors")
    `;

    // Filter specific sensor if requested
    if (sensor) {
      const fields = sensor.split(",").map(f => `r._field == "${f}"`).join(" or ");
      fluxQuery += `|> filter(fn: (r) => ${fields})\n`;
    } else {
      fluxQuery += `|> filter(fn: (r) => r._field == "co2" or r._field == "temperature" or r._field == "humidity" or r._field == "light" or r._field == "soil_moisture")\n`;
    }

    // Aggregate for long time ranges to reduce data points
    if (aggregate) {
      fluxQuery += `|> aggregateWindow(every: ${aggregate}, fn: mean, createEmpty: false)\n`;
    }

    fluxQuery += `|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"])`;

    const influx = getInflux();
    const queryApi = influx.getQueryApi(org);
    const rows = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          rows.push({
            time: o._time,
            co2: o.co2 != null ? Math.round(o.co2) : null,
            temperature: o.temperature != null ? +o.temperature.toFixed(1) : null,
            humidity: o.humidity != null ? +o.humidity.toFixed(1) : null,
            light: o.light != null ? Math.round(o.light) : null,
            soil_moisture: o.soil_moisture != null ? +o.soil_moisture.toFixed(1) : null,
          });
        },
        error: reject,
        complete: resolve,
      });
    });

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error("[DATA] Sensor query error:", err.message);
    res.status(500).json({ error: "Failed to query sensor data", detail: err.message });
  }
});

// ─── GET /api/data/status ───
// Get latest device status
router.get("/status", async (req, res) => {
  try {
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -15m)
        |> filter(fn: (r) => r._measurement == "mqtt_consumer")
        |> filter(fn: (r) => r.topic == "greenhouse/lepaa/status")
        |> last()
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    const influx = getInflux();
    const queryApi = influx.getQueryApi(org);
    const rows = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) { rows.push(tableMeta.toObject(row)); },
        error: reject,
        complete: resolve,
      });
    });

    if (rows.length === 0) {
      return res.json({ status: null, online: false });
    }

    const r = rows[0];
    res.json({
      online: true,
      status: {
        device: r.device || "LEPAA-GH-01",
        uptime_sec: r.uptime_sec,
        readings: r.readings,
        publish_failures: r.publish_failures,
        wifi_rssi: r.wifi_rssi,
        free_heap: r.free_heap,
        time_synced: r.time_synced,
        sd_buffered: r.sd_buffered || r["sd_card.buffered"] || 0,
        sd_used_mb: r.sd_used_mb || r["sd_card.used_mb"] || 0,
        sd_total_mb: r.sd_total_mb || r["sd_card.total_mb"] || 0,
        last_seen: r._time,
      },
    });
  } catch (err) {
    console.error("[DATA] Status query error:", err.message);
    res.status(500).json({ error: "Failed to query device status", detail: err.message });
  }
});

// ─── GET /api/data/latest ───
// Get the most recent sensor reading
router.get("/latest", async (req, res) => {
  try {
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "mqtt_consumer")
        |> filter(fn: (r) => r.topic == "greenhouse/lepaa/sensors")
        |> last()
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    const influx = getInflux();
    const queryApi = influx.getQueryApi(org);
    const rows = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) { rows.push(tableMeta.toObject(row)); },
        error: reject,
        complete: resolve,
      });
    });

    if (rows.length === 0) {
      return res.json({ reading: null });
    }

    const r = rows[0];
    res.json({
      reading: {
        time: r._time,
        co2: r.co2 != null ? Math.round(r.co2) : null,
        temperature: r.temperature != null ? +r.temperature.toFixed(1) : null,
        humidity: r.humidity != null ? +r.humidity.toFixed(1) : null,
        light: r.light != null ? Math.round(r.light) : null,
        soil_moisture: r.soil_moisture != null ? +r.soil_moisture.toFixed(1) : null,
        msg_id: r.msg_id || null,
      },
    });
  } catch (err) {
    console.error("[DATA] Latest query error:", err.message);
    res.status(500).json({ error: "Failed to query latest reading" });
  }
});

// ─── GET /api/data/export ───
// Export CSV with msg_id for data integrity verification
router.get("/export", async (req, res) => {
  try {
    const { start, end } = req.query;
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${start ? `time(v: "${start}")` : "-7d"}${end ? `, stop: time(v: "${end}")` : ""})
        |> filter(fn: (r) => r._measurement == "mqtt_consumer")
        |> filter(fn: (r) => r.topic == "greenhouse/lepaa/sensors")
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;

    const influx = getInflux();
    const queryApi = influx.getQueryApi(org);
    const rows = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) { rows.push(tableMeta.toObject(row)); },
        error: reject,
        complete: resolve,
      });
    });

    const header = "time,msg_id,co2,temperature,humidity,light,soil_moisture";
    const csvRows = rows.map(r =>
      `${r._time},${r.msg_id || ""},${r.co2 || ""},${r.temperature || ""},${r.humidity || ""},${r.light || ""},${r.soil_moisture || ""}`
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=greenhouse-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send([header, ...csvRows].join("\n"));
  } catch (err) {
    console.error("[DATA] Export error:", err.message);
    res.status(500).json({ error: "Export failed" });
  }
});

// ══════════════════════════════════════════
// ALERT CONFIGURATION
// ══════════════════════════════════════════

// ─── GET /api/data/alerts/config ───
router.get("/alerts/config", (req, res) => {
  const db = getDb();
  const configs = db.prepare("SELECT * FROM alert_configs ORDER BY sensor_key").all();
  db.close();
  res.json({ configs });
});

// ─── PUT /api/data/alerts/config ─── (admin + operator)
router.put("/alerts/config", authorize("admin", "operator"), (req, res) => {
  const { configs } = req.body;
  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: "configs array required" });
  }

  const db = getDb();
  const update = db.prepare(
    "UPDATE alert_configs SET min_value = ?, max_value = ?, enabled = ?, updated_by = ?, updated_at = datetime('now') WHERE sensor_key = ?"
  );

  const tx = db.transaction(() => {
    configs.forEach(c => {
      update.run(c.min_value, c.max_value, c.enabled ? 1 : 0, req.user.id, c.sensor_key);
    });
  });
  tx();

  const updated = db.prepare("SELECT * FROM alert_configs ORDER BY sensor_key").all();
  db.close();
  res.json({ configs: updated });
});

// ─── GET /api/data/alerts/history ───
router.get("/alerts/history", (req, res) => {
  const { limit } = req.query;
  const db = getDb();
  const history = db.prepare(
    "SELECT * FROM alert_history ORDER BY triggered_at DESC LIMIT ?"
  ).all(parseInt(limit) || 50);
  db.close();
  res.json({ history });
});

module.exports = router;
