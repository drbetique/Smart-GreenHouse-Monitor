import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import { useLang } from "../context/LangContext";
import LangToggle from "../components/LangToggle";

const generateData = (hours = 24) => {
  const data = [];
  const now = Date.now();
  for (let i = hours * 60; i >= 0; i -= 1) {
    const t = new Date(now - i * 60000);
    const hour = t.getHours();
    const df = Math.sin((hour - 6) * Math.PI / 12);
    data.push({
      time: t.toISOString(), ts: t.getTime(),
      timeLabel: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      dateLabel: t.toLocaleDateString([], { month: "short", day: "numeric" }),
      co2: Math.round(420 + df * 80 + Math.random() * 30),
      temperature: +(20 + df * 4 + Math.random() * 1.5).toFixed(1),
      humidity: +(62 + df * -8 + Math.random() * 3).toFixed(1),
      light: Math.max(0, Math.round((df + 0.3) * 15000 + Math.random() * 2000)),
      soil_moisture: +(45 + Math.sin(i / 120) * 5 + Math.random() * 2).toFixed(1),
      msg_id: `A1B2C3D4-0001-${String(hours * 60 - i).padStart(5, "0")}`,
    });
  }
  return data;
};

const generateStatus = () => ({
  device: "LEPAA-GH-01", firmware: "1.0.0",
  location: "Lepaa Greenhouse Facility - Strawberry Section",
  uptime_sec: 259200 + Math.floor(Math.random() * 3600),
  readings: 4320 + Math.floor(Math.random() * 60),
  publish_failures: Math.floor(Math.random() * 3),
  wifi_rssi: -45 - Math.floor(Math.random() * 20),
  free_heap: 180000 + Math.floor(Math.random() * 20000),
  time_synced: true,
  sd_card: { available: true, total_mb: 7400, used_mb: 12 + Math.floor(Math.random() * 5), buffered: 0 },
  last_seen: new Date().toISOString(),
});

const SENSORS = [
  { key: "co2", tKey: "sensor.co2", unit: "ppm", color: "#34d399", icon: "🫁", min: 300, max: 1200, optLow: 400, optHigh: 800 },
  { key: "temperature", tKey: "sensor.temperature", unit: "°C", color: "#fb923c", icon: "🌡️", min: 10, max: 40, optLow: 18, optHigh: 28 },
  { key: "humidity", tKey: "sensor.humidity", unit: "%", color: "#38bdf8", icon: "💧", min: 20, max: 100, optLow: 50, optHigh: 75 },
  { key: "light", tKey: "sensor.light", unit: "lux", color: "#fbbf24", icon: "☀️", min: 0, max: 40000, optLow: 5000, optHigh: 25000 },
  { key: "soil_moisture", tKey: "sensor.soil", unit: "%", color: "#4ade80", icon: "🌱", min: 0, max: 100, optLow: 30, optHigh: 60 },
];

const THRESHOLDS = {
  co2: { low: 300, high: 800, critHigh: 1200 },
  temperature: { low: 15, high: 30, critHigh: 35, critLow: 5 },
  humidity: { low: 40, high: 80, critHigh: 95 },
  light: { low: 0, high: 30000, critHigh: 45000 },
  soil_moisture: { low: 25, high: 65, critHigh: 85, critLow: 10 },
};

function checkAlerts(reading) {
  const alerts = [];
  if (!reading) return alerts;
  SENSORS.forEach((s) => {
    const val = reading[s.key]; const th = THRESHOLDS[s.key];
    if (val == null || !th) return;
    if (th.critHigh && val >= th.critHigh) alerts.push({ sensor: s, level: "critical", msg: `${s.key} critically high: ${val}${s.unit}` });
    else if (th.critLow && val <= th.critLow) alerts.push({ sensor: s, level: "critical", msg: `${s.key} critically low: ${val}${s.unit}` });
    else if (val >= th.high) alerts.push({ sensor: s, level: "warning", msg: `${s.key} above optimal: ${val}${s.unit}` });
    else if (val <= th.low) alerts.push({ sensor: s, level: "warning", msg: `${s.key} below optimal: ${val}${s.unit}` });
  });
  return alerts;
}

function formatUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getSignal(rssi) {
  if (rssi > -50) return { tKey: "wifi.excellent", color: "#34d399" };
  if (rssi > -60) return { tKey: "wifi.good", color: "#34d399" };
  if (rssi > -70) return { tKey: "wifi.fair", color: "#fbbf24" };
  return { tKey: "wifi.weak", color: "#ef4444" };
}

function exportCSV(data) {
  if (!data.length) return;
  const h = ["time","msg_id","co2","temperature","humidity","light","soil_moisture"];
  const rows = [h.join(","), ...data.map(r => h.map(k => r[k] ?? "").join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `greenhouse-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function LeafBg() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 60%)" }} />
      <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(4,120,87,0.03) 0%, transparent 60%)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.015, backgroundImage: "radial-gradient(circle at 1px 1px, #10b981 0.5px, transparent 0)", backgroundSize: "40px 40px" }} />
      {[{ top: 60, right: 40, rot: 15, sc: 1 }, { bottom: 100, left: 30, rot: -30, sc: 0.8 }, { top: "40%", right: "5%", rot: 45, sc: 0.6 }].map((p, i) => (
        <svg key={i} width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ position: "absolute", opacity: 0.035, top: p.top, right: p.right, bottom: p.bottom, left: p.left, transform: `rotate(${p.rot}deg) scale(${p.sc})` }}>
          <path d="M60 10C60 10 20 40 20 70C20 90 38 110 60 110C82 110 100 90 100 70C100 40 60 10 60 10Z" fill="#10b981" />
          <path d="M60 30V100" stroke="#059669" strokeWidth="1.5" /><path d="M60 50C45 45 35 55 30 65" stroke="#059669" strokeWidth="1" />
          <path d="M60 65C75 60 85 50 90 55" stroke="#059669" strokeWidth="1" /><path d="M60 80C48 75 38 80 35 85" stroke="#059669" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

function MiniGauge({ value, min, max, optLow, optHigh, color, size = 40 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = (size - 8) / 2, cx = size / 2, cy = size / 2;
  const sa = -225, ea = 45, range = ea - sa;
  const p2c = (a) => ({ x: cx + r * Math.cos(a * Math.PI / 180), y: cy + r * Math.sin(a * Math.PI / 180) });
  const bs = p2c(sa), be = p2c(ea);
  const os = p2c(sa + ((optLow - min) / (max - min)) * range);
  const oe = p2c(sa + ((optHigh - min) / (max - min)) * range);
  const np = p2c(sa + pct * range);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={`M${bs.x},${bs.y} A${r},${r} 0 1,1 ${be.x},${be.y}`} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M${os.x},${os.y} A${r},${r} 0 0,1 ${oe.x},${oe.y}`} fill="none" stroke={`${color}30`} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={np.x} cy={np.y} r="2.5" fill={color} /><line x1={cx} y1={cy} x2={np.x} y2={np.y} stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

const PRESETS = [{ label: "1H", hours: 1 }, { label: "6H", hours: 6 }, { label: "24H", hours: 24 }, { label: "3D", hours: 72 }, { label: "7D", hours: 168 }, { label: "30D", hours: 720 }];

const PERIOD_PRESETS = [
  { tKey: "date.today", fn: () => { const s = new Date(); s.setHours(0,0,0,0); return [s, new Date()]; } },
  { tKey: "date.yesterday", fn: () => { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(s); e.setHours(23,59,59,999); return [s, e]; } },
  { tKey: "date.thisWeek", fn: () => { const s = new Date(); s.setDate(s.getDate()-s.getDay()); s.setHours(0,0,0,0); return [s, new Date()]; } },
  { tKey: "date.thisMonth", fn: () => { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); return [s, new Date()]; } },
  { tKey: "date.lastMonth", fn: () => { const s = new Date(); s.setMonth(s.getMonth()-1); s.setDate(1); s.setHours(0,0,0,0); const e = new Date(s.getFullYear(), s.getMonth()+1, 0, 23, 59, 59); return [s, e]; } },
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const cardBg = "linear-gradient(145deg, rgba(6,30,22,0.85), rgba(15,23,42,0.92))";
const panelBg = "linear-gradient(145deg, rgba(6,30,22,0.7), rgba(15,23,42,0.85))";
const panelBorder = "1px solid rgba(52,211,153,0.08)";
const mono = "'JetBrains Mono', monospace";
const sans = "'DM Sans', sans-serif";

function SensorCard({ sensor, value, data, alerts }) {
  const { t } = useLang();
  const hasAlert = alerts.some(a => a.sensor.key === sensor.key);
  const lvl = alerts.find(a => a.sensor.key === sensor.key)?.level;
  const prev = data.length > 1 ? data[data.length - 2]?.[sensor.key] : value;
  const trend = value > prev ? "↑" : value < prev ? "↓" : "→";
  const tc = trend === "↑" ? "#fb923c" : trend === "↓" ? "#38bdf8" : "#475569";
  return (
    <div style={{ background: cardBg, border: `1px solid ${lvl === "critical" ? "#ef444480" : lvl === "warning" ? "#fbbf2450" : "rgba(52,211,153,0.1)"}`, borderRadius: 20, padding: "18px 16px 14px", position: "relative", overflow: "hidden", boxShadow: hasAlert ? `0 0 20px ${lvl === "critical" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.1)"}` : "0 4px 24px rgba(0,0,0,0.2)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${sensor.color}, transparent)`, opacity: 0.6 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: mono, fontWeight: 500 }}>{t(sensor.tKey)}</span>
        <MiniGauge value={value || 0} min={sensor.min} max={sensor.max} optLow={sensor.optLow} optHigh={sensor.optHigh} color={sensor.color} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: 38, fontWeight: 700, color: "#f1f5f9", fontFamily: sans, lineHeight: 1, letterSpacing: -1 }}>
          {typeof value === "number" ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)) : "--"}
        </span>
        <span style={{ fontSize: 13, color: "#475569", fontWeight: 500, fontFamily: sans }}>{sensor.unit}</span>
        <span style={{ fontSize: 16, color: tc, marginLeft: "auto", fontWeight: 700 }}>{trend}</span>
      </div>
      <div style={{ fontSize: 9, color: "#475569", fontFamily: mono, marginBottom: 8 }}>{t("sensor.optimal")}: {sensor.optLow}-{sensor.optHigh} {sensor.unit}</div>
      <div style={{ height: 36, marginLeft: -8, marginRight: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.slice(-40)}>
            <defs><linearGradient id={`s-${sensor.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={sensor.color} stopOpacity={0.25} /><stop offset="100%" stopColor={sensor.color} stopOpacity={0} /></linearGradient></defs>
            <Area type="monotone" dataKey={sensor.key} stroke={sensor.color} fill={`url(#s-${sensor.key})`} strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {hasAlert && <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: lvl === "critical" ? "#ef4444" : "#fbbf24", boxShadow: `0 0 8px ${lvl === "critical" ? "#ef4444" : "#fbbf24"}`, animation: "pulse 2s infinite" }} />}
    </div>
  );
}

function ChartPanel({ data, selectedSensors }) {
  const { t } = useLang();
  const step = Math.max(1, Math.floor(data.length / 100));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  const showDate = data.length > 0 && (new Date(data[data.length - 1]?.time) - new Date(data[0]?.time)) > 86400000;
  return (
    <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 24, boxShadow: "0 4px 32px rgba(0,0,0,0.2)" }}>
      <div style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sampled} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,211,153,0.05)" />
            <XAxis dataKey={showDate ? "dateLabel" : "timeLabel"} stroke="#1e3a2f" fontSize={10} tickLine={false} interval={Math.max(0, Math.floor(sampled.length / 8))} fontFamily={mono} tick={{ fill: "#475569" }} />
            <YAxis stroke="#1e3a2f" fontSize={10} tickLine={false} fontFamily={mono} tick={{ fill: "#475569" }} />
            <Tooltip contentStyle={{ background: "rgba(6,30,22,0.95)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 14, fontSize: 11, fontFamily: mono }} labelStyle={{ color: "#64748b" }} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: sans, paddingTop: 8 }} iconType="circle" iconSize={7} />
            {SENSORS.filter(s => selectedSensors.includes(s.key)).map(s => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={`${s.icon} ${t(s.tKey)}`} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: s.color }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SensorChart({ sensor, data }) {
  const { t } = useLang();
  const step = Math.max(1, Math.floor(data.length / 100));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  const vals = sampled.map(d => d[sensor.key]).filter(v => v != null);
  const mn = vals.length ? Math.min(...vals) : 0, mx = vals.length ? Math.max(...vals) : 0;
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
  const showDate = data.length > 0 && (new Date(data[data.length - 1]?.time) - new Date(data[0]?.time)) > 86400000;
  return (
    <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{sensor.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", fontFamily: sans }}>{t(sensor.tKey)}</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 10, fontFamily: mono }}>
          <span style={{ color: "#475569" }}>{t("sensor.min")} <span style={{ color: "#38bdf8" }}>{mn}</span></span>
          <span style={{ color: "#475569" }}>{t("sensor.avg")} <span style={{ color: "#94a3b8" }}>{avg}</span></span>
          <span style={{ color: "#475569" }}>{t("sensor.max")} <span style={{ color: "#fb923c" }}>{mx}</span></span>
        </div>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampled} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs><linearGradient id={`d-${sensor.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={sensor.color} stopOpacity={0.2} /><stop offset="100%" stopColor={sensor.color} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,211,153,0.04)" />
            <XAxis dataKey={showDate ? "dateLabel" : "timeLabel"} stroke="#1e3a2f" fontSize={9} tickLine={false} interval={Math.max(0, Math.floor(sampled.length / 6))} fontFamily={mono} tick={{ fill: "#475569" }} />
            <YAxis stroke="#1e3a2f" fontSize={9} tickLine={false} fontFamily={mono} tick={{ fill: "#475569" }} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip contentStyle={{ background: "rgba(6,30,22,0.95)", border: `1px solid ${sensor.color}30`, borderRadius: 12, fontSize: 10, fontFamily: mono }} formatter={val => [`${val} ${sensor.unit}`, t(sensor.tKey)]} />
            <ReferenceLine y={sensor.optHigh} stroke={sensor.color} strokeDasharray="4 4" strokeOpacity={0.3} />
            <ReferenceLine y={sensor.optLow} stroke={sensor.color} strokeDasharray="4 4" strokeOpacity={0.3} />
            <Area type="monotone" dataKey={sensor.key} stroke={sensor.color} fill={`url(#d-${sensor.key})`} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: sensor.color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Btn({ active, onClick, children, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 13px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
      fontFamily: sans, whiteSpace: "nowrap", transition: "all 0.2s",
      border: active ? `1px solid ${color || "#34d399"}` : "1px solid rgba(148,163,184,0.1)",
      background: active ? `${color || "#34d399"}15` : "transparent",
      color: active ? (color || "#34d399") : "#475569",
    }}>{children}</button>
  );
}

function CalendarPicker({ value, onChange, onClose, label }) {
  const { t } = useLang();
  const [viewMode, setViewMode] = useState("day");
  const [viewDate, setViewDate] = useState(new Date(value));
  const [viewYear, setViewYear] = useState(new Date(value).getFullYear());
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const valDate = new Date(value);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, cur: false, date: new Date(year, month - 1, prevDays - i) });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true, date: new Date(year, month, d) });
  for (let d = 1; cells.length < 42; d++) cells.push({ day: d, cur: false, date: new Date(year, month + 1, d) });

  const isSel = d => { const v = new Date(valDate); v.setHours(0,0,0,0); const c = new Date(d); c.setHours(0,0,0,0); return v.getTime() === c.getTime(); };
  const isTod = d => { const c = new Date(d); c.setHours(0,0,0,0); return today.getTime() === c.getTime(); };
  const selectDay = d => { const nd = new Date(valDate); nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onChange(nd.toISOString().slice(0, 16)); onClose(); };
  const selectMonth = m => { const nd = new Date(viewDate); nd.setMonth(m); setViewDate(nd); setViewMode("day"); };
  const selectYear = y => { const nd = new Date(viewDate); nd.setFullYear(y); setViewDate(nd); setViewYear(y); setViewMode("month"); };
  const navMonth = dir => { const nd = new Date(viewDate); nd.setMonth(nd.getMonth() + dir); setViewDate(nd); };
  const yearStart = Math.floor(viewYear / 12) * 12;

  const btn = { background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: "4px 8px", borderRadius: 6, transition: "all 0.15s", fontFamily: sans };

  return (
    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 100, background: "rgba(6,28,20,0.97)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 16, padding: 14, width: 280, boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(52,211,153,0.05)", backdropFilter: "blur(20px)" }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 9, color: "#3d6b5a", fontFamily: mono, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>{label}</div>

      {viewMode === "day" && (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => navMonth(-1)} style={btn}>‹</button>
          <button onClick={() => setViewMode("month")} style={{ ...btn, color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{MONTHS_FULL[month]} {year}</button>
          <button onClick={() => navMonth(1)} style={btn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 4 }}>
          {WKDAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: "#3d6b5a", fontWeight: 600, padding: "4px 0", fontFamily: mono }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
          {cells.map((c, i) => { const sel = isSel(c.date), tod = isTod(c.date); return (
            <button key={i} onClick={() => selectDay(c.date)} style={{ ...btn, width: 36, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? "#061c14" : c.cur ? "#cbd5e1" : "#2d4a3e", background: sel ? "#34d399" : tod ? "rgba(52,211,153,0.1)" : "transparent", borderRadius: 10, border: tod && !sel ? "1px solid rgba(52,211,153,0.25)" : "1px solid transparent", fontFamily: mono }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(52,211,153,0.08)"; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = tod ? "rgba(52,211,153,0.1)" : "transparent"; }}
            >{c.day}</button>); })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button onClick={() => selectDay(new Date())} style={{ ...btn, fontSize: 10, color: "#34d399", fontWeight: 600 }}>{t("date.today")}</button>
        </div>
      </>)}

      {viewMode === "month" && (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setViewDate(new Date(year - 1, month))} style={btn}>‹</button>
          <button onClick={() => setViewMode("year")} style={{ ...btn, color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{year}</button>
          <button onClick={() => setViewDate(new Date(year + 1, month))} style={btn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {MONTHS_SHORT.map((m, i) => { const sel = i === valDate.getMonth() && year === valDate.getFullYear(), cur = i === today.getMonth() && year === today.getFullYear(); return (
            <button key={m} onClick={() => selectMonth(i)} style={{ ...btn, padding: "10px 0", fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? "#061c14" : cur ? "#34d399" : "#94a3b8", background: sel ? "#34d399" : "rgba(15,23,42,0.3)", borderRadius: 10, border: cur && !sel ? "1px solid rgba(52,211,153,0.25)" : "1px solid transparent" }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(52,211,153,0.1)"; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? "#34d399" : "rgba(15,23,42,0.3)"; }}
            >{m}</button>); })}
        </div>
      </>)}

      {viewMode === "year" && (<>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setViewYear(p => p - 12)} style={btn}>‹</button>
          <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>{yearStart} – {yearStart + 11}</span>
          <button onClick={() => setViewYear(p => p + 12)} style={btn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {Array.from({ length: 12 }, (_, i) => yearStart + i).map(y => { const sel = y === valDate.getFullYear(), cur = y === today.getFullYear(); return (
            <button key={y} onClick={() => selectYear(y)} style={{ ...btn, padding: "10px 0", fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? "#061c14" : cur ? "#34d399" : "#94a3b8", background: sel ? "#34d399" : "rgba(15,23,42,0.3)", borderRadius: 10, border: cur && !sel ? "1px solid rgba(52,211,153,0.25)" : "1px solid transparent", fontFamily: mono }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(52,211,153,0.1)"; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? "#34d399" : "rgba(15,23,42,0.3)"; }}
            >{y}</button>); })}
        </div>
      </>)}
    </div>
  );
}

function DateRange({ startDate, endDate, onStart, onEnd, activePreset, onPreset, activePeriod, onPeriod }) {
  const { t } = useLang();
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const startRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (startRef.current && !startRef.current.contains(e.target)) setShowStartCal(false);
      if (endRef.current && !endRef.current.contains(e.target)) setShowEndCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fmt = v => { const d = new Date(v); return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  const calIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3d6b5a" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "rgba(6,28,20,0.6)", borderRadius: 14, border: panelBorder }}>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => onPreset(p)} style={{
            padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: sans,
            border: activePreset === p.label && activePeriod == null ? "1px solid #34d399" : "1px solid rgba(148,163,184,0.1)",
            background: activePreset === p.label && activePeriod == null ? "rgba(52,211,153,0.12)" : "transparent",
            color: activePreset === p.label && activePeriod == null ? "#34d399" : "#64748b", transition: "all 0.2s",
          }}>{p.label}</button>
        ))}
        <div style={{ width: 1, height: 22, background: "rgba(148,163,184,0.08)", margin: "0 4px" }} />
        {PERIOD_PRESETS.map((p, i) => (
          <button key={p.tKey} onClick={() => onPeriod(p, i)} style={{
            padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: sans,
            border: activePeriod === i ? "1px solid rgba(96,165,250,0.5)" : "1px solid rgba(148,163,184,0.06)",
            background: activePeriod === i ? "rgba(96,165,250,0.1)" : "transparent",
            color: activePeriod === i ? "#60a5fa" : "#475569", transition: "all 0.2s",
          }}>{t(p.tKey)}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#3d6b5a", fontFamily: mono, fontWeight: 600, letterSpacing: 0.5 }}>{t("date.from")}</span>
        <div ref={startRef} style={{ position: "relative" }}>
          <button onClick={() => { setShowStartCal(!showStartCal); setShowEndCal(false); }} style={{
            padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.12)", background: "rgba(15,23,42,0.5)",
            color: "#cbd5e1", fontSize: 11, fontFamily: mono, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(52,211,153,0.12)"}>
            {calIcon} {fmt(startDate)}
          </button>
          {showStartCal && <CalendarPicker value={startDate} onChange={v => { onStart(v); }} onClose={() => setShowStartCal(false)} label={t("date.selectStart")} />}
        </div>
        <span style={{ fontSize: 10, color: "#3d6b5a", fontFamily: mono, fontWeight: 600, letterSpacing: 0.5 }}>{t("date.to")}</span>
        <div ref={endRef} style={{ position: "relative" }}>
          <button onClick={() => { setShowEndCal(!showEndCal); setShowStartCal(false); }} style={{
            padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.12)", background: "rgba(15,23,42,0.5)",
            color: "#cbd5e1", fontSize: 11, fontFamily: mono, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(52,211,153,0.12)"}>
            {calIcon} {fmt(endDate)}
          </button>
          {showEndCal && <CalendarPicker value={endDate} onChange={v => { onEnd(v); }} onClose={() => setShowEndCal(false)} label={t("date.selectEnd")} />}
        </div>
      </div>
    </div>
  );
}

export default function GreenhouseDashboard() {
  const { t } = useLang();
  const [allData, setAllData] = useState([]);
  const [status, setStatus] = useState(null);
  const [sel, setSel] = useState(["co2", "temperature"]);
  const [tab, setTab] = useState("overview");
  const [lastUp, setLastUp] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertHist, setAlertHist] = useState([]);
  const n = new Date();
  const [preset, setPreset] = useState("24H");
  const [periodPreset, setPeriodPreset] = useState(null);
  const [sd, setSd] = useState(new Date(n - 24 * 3600000).toISOString().slice(0, 16));
  const [ed, setEd] = useState(n.toISOString().slice(0, 16));

  useEffect(() => {
    setAllData(generateData(168));
    setStatus(generateStatus());
    setLastUp(new Date());
    const iv = setInterval(() => {
      setAllData(prev => {
        const now = new Date(), h = now.getHours(), df = Math.sin((h - 6) * Math.PI / 12);
        return [...prev.slice(-10080), { time: now.toISOString(), ts: now.getTime(), timeLabel: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), dateLabel: now.toLocaleDateString([], { month: "short", day: "numeric" }), co2: Math.round(420 + df * 80 + Math.random() * 30), temperature: +(20 + df * 4 + Math.random() * 1.5).toFixed(1), humidity: +(62 + df * -8 + Math.random() * 3).toFixed(1), light: Math.max(0, Math.round((df + 0.3) * 15000 + Math.random() * 2000)), soil_moisture: +(45 + Math.sin(Date.now() / 120000) * 5 + Math.random() * 2).toFixed(1), msg_id: `A1B2C3D4-0001-${String(prev.length + 1).padStart(5, "0")}` }];
      });
      setStatus(generateStatus());
      setLastUp(new Date());
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!allData.length) return;
    const na = checkAlerts(allData[allData.length - 1]);
    setAlerts(na);
    if (na.length) setAlertHist(p => [...na.map(a => ({ ...a, time: new Date().toLocaleTimeString() })), ...p].slice(0, 50));
  }, [allData]);

  const filtered = allData.filter(d => { const ts = new Date(d.time).getTime(); return ts >= new Date(sd).getTime() && ts <= new Date(ed).getTime(); });
  const handlePreset = p => { const nn = new Date(); setEd(nn.toISOString().slice(0, 16)); setSd(new Date(nn - p.hours * 3600000).toISOString().slice(0, 16)); setPreset(p.label); setPeriodPreset(null); };
  const handlePeriod = (p, idx) => { const [s, e] = p.fn(); setSd(s.toISOString().slice(0, 16)); setEd(e.toISOString().slice(0, 16)); setPeriodPreset(idx); setPreset(null); };
  const toggle = useCallback(k => setSel(p => p.includes(k) ? (p.length > 1 ? p.filter(x => x !== k) : p) : [...p, k]), []);
  const latest = allData[allData.length - 1] || {};

  const tabs = [
    { key: "overview", label: t("tab.overview"), icon: "📊" },
    { key: "charts", label: t("tab.charts"), icon: "📈" },
    { key: "alerts", label: t("tab.alerts"), icon: "🔔", badge: alerts.length },
    { key: "device", label: t("tab.device"), icon: "⚙️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg, #010d05 0%, #021a0a 25%, #0a1628 50%, #020617 100%)", color: "#e2e8f0", fontFamily: `${sans}`, position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}input[type="datetime-local"]::-webkit-calendar-picker-indicator{filter:invert(.5);cursor:pointer}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(52,211,153,.2);border-radius:4px}`}</style>
      <LeafBg />

      <header style={{ padding: "20px 24px 0", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #059669, #047857)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 16px rgba(5,150,105,0.3)" }}>🌿</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5, color: "#f0fdf4" }}>{t("dash.title")}</h1>
              <p style={{ fontSize: 10, color: "#34d399", margin: 0, fontFamily: mono, letterSpacing: 2, opacity: 0.7 }}>{t("dash.subtitle")}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {alerts.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} /><span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>{alerts.length} {t(alerts.length > 1 ? "alert.counts" : "alert.count")}</span></div>}
            {lastUp && <span style={{ fontSize: 10, color: "#334155", fontFamily: mono }}>{lastUp.toLocaleTimeString()}</span>}
            <LangToggle />
            <button onClick={() => exportCSV(filtered)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.08)", color: "#34d399", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: sans, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>{t("export.csv")}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, marginTop: 20, borderBottom: "1px solid rgba(52,211,153,0.06)", overflowX: "auto" }}>
          {tabs.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{ padding: "10px 18px", background: "none", border: "none", borderBottom: tab === tb.key ? "2px solid #34d399" : "2px solid transparent", color: tab === tb.key ? "#f0fdf4" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: sans, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 13 }}>{tb.icon}</span>{tb.label}
              {tb.badge > 0 && <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>{tb.badge}</span>}
            </button>
          ))}
        </div>
      </header>

      <main style={{ padding: "20px 24px 60px", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 10 }}>

        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
              {SENSORS.map(s => <SensorCard key={s.key} sensor={s} value={latest[s.key]} data={allData} alerts={alerts} />)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <DateRange startDate={sd} endDate={ed} onStart={v => { setSd(v); setPreset(null); setPeriodPreset(null); }} onEnd={v => { setEd(v); setPreset(null); setPeriodPreset(null); }} activePreset={preset} onPreset={handlePreset} activePeriod={periodPreset} onPeriod={handlePeriod} />
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {SENSORS.map(s => <Btn key={s.key} active={sel.includes(s.key)} onClick={() => toggle(s.key)} color={s.color}>{s.icon} {t(s.tKey)}</Btn>)}
              </div>
            </div>
            <ChartPanel data={filtered} selectedSensors={sel} />
            {status && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "12px 18px", background: "rgba(6,30,22,0.6)", borderRadius: 14, border: "1px solid rgba(52,211,153,0.06)", fontFamily: mono, fontSize: 10, color: "#475569" }}>
                <span><span style={{ color: "#34d399", fontSize: 8 }}>●</span> {t("status.online")}</span>
                <span>{t("status.uptime")}: <span style={{ color: "#94a3b8" }}>{formatUptime(status.uptime_sec)}</span></span>
                <span>{t("status.wifi")}: <span style={{ color: getSignal(status.wifi_rssi).color }}>{status.wifi_rssi}dBm</span></span>
                <span>{t("status.readings")}: <span style={{ color: "#94a3b8" }}>{status.readings.toLocaleString()}</span></span>
                <span>{t("status.sdBuffer")}: <span style={{ color: status.sd_card.buffered > 0 ? "#fb923c" : "#34d399" }}>{status.sd_card.buffered}</span></span>
              </div>
            )}
          </div>
        )}

        {tab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <DateRange startDate={sd} endDate={ed} onStart={v => { setSd(v); setPreset(null); setPeriodPreset(null); }} onEnd={v => { setEd(v); setPreset(null); setPeriodPreset(null); }} activePreset={preset} onPreset={handlePreset} activePeriod={periodPreset} onPeriod={handlePeriod} />
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {SENSORS.map(s => <Btn key={s.key} active={sel.includes(s.key)} onClick={() => toggle(s.key)} color={s.color}>{s.icon} {t(s.tKey)}</Btn>)}
              </div>
            </div>
            <ChartPanel data={filtered} selectedSensors={sel} />
            {SENSORS.filter(s => sel.includes(s.key)).map(s => <SensorChart key={s.key} sensor={s} data={filtered} />)}
          </div>
        )}

        {tab === "alerts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 14 }}>🔔</span>
                <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono, letterSpacing: 1, fontWeight: 500 }}>{t("alert.thresholds").toUpperCase()}</span>
                {alerts.length > 0 && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>{alerts.length} {t(alerts.length > 1 ? "alert.counts" : "alert.count")}</span>}
              </div>
              {alerts.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center" }}><span style={{ fontSize: 28 }}>✅</span><p style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>{t("alert.noAlerts")}</p></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: `1px solid ${a.level === "critical" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)"}`, background: a.level === "critical" ? "rgba(239,68,68,0.06)" : "rgba(251,191,36,0.04)" }}>
                      <span style={{ fontSize: 16 }}>{a.sensor.icon}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "#e2e8f0" }}>{a.msg}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, background: a.level === "critical" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)", color: a.level === "critical" ? "#ef4444" : "#fbbf24" }}>{a.level}</span>
                    </div>
                  ))}
                </div>
              )}
              {alertHist.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <span style={{ fontSize: 10, color: "#475569", fontFamily: mono, letterSpacing: 1 }}>{t("alert.history").toUpperCase()}</span>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
                    {alertHist.slice(0, 10).map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#475569", fontFamily: mono }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.level === "critical" ? "#ef4444" : "#fbbf24", opacity: 0.5, flexShrink: 0 }} />
                        <span style={{ color: "#334155" }}>{a.time}</span><span>{a.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 20 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono, letterSpacing: 1, fontWeight: 500 }}>{t("alert.thresholds").toUpperCase()}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
                {SENSORS.map(s => { const th = THRESHOLDS[s.key]; return (
                  <div key={s.key} style={{ padding: "14px 16px", background: "rgba(6,30,22,0.5)", borderRadius: 14, border: "1px solid rgba(52,211,153,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><span style={{ fontSize: 14 }}>{s.icon}</span><span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{t(s.tKey)}</span><span style={{ fontSize: 10, color: "#475569" }}>({s.unit})</span></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 10, fontFamily: mono }}>
                      {th.critLow != null && <div style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}><div style={{ color: "#64748b", marginBottom: 2 }}>Crit Low</div><div style={{ color: "#ef4444", fontWeight: 600 }}>{th.critLow}</div></div>}
                      <div style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.08)" }}><div style={{ color: "#64748b", marginBottom: 2 }}>Low</div><div style={{ color: "#fbbf24", fontWeight: 600 }}>{th.low}</div></div>
                      <div style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.08)" }}><div style={{ color: "#64748b", marginBottom: 2 }}>High</div><div style={{ color: "#fbbf24", fontWeight: 600 }}>{th.high}</div></div>
                      <div style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}><div style={{ color: "#64748b", marginBottom: 2 }}>Crit High</div><div style={{ color: "#ef4444", fontWeight: 600 }}>{th.critHigh}</div></div>
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          </div>
        )}

        {tab === "device" && status && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 12px #34d399" }} />
                <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono, letterSpacing: 1.5, fontWeight: 500 }}>{status.device}</span>
                <span style={{ fontSize: 10, color: "#34d399", fontFamily: mono, background: "rgba(52,211,153,0.1)", padding: "2px 8px", borderRadius: 6 }}>{t("device.online")}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155", fontFamily: mono }}>v{status.firmware}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {[
                  { l: t("device.uptime"), v: formatUptime(status.uptime_sec), c: "#34d399", i: "⏱" },
                  { l: t("device.totalReadings"), v: status.readings.toLocaleString(), c: "#38bdf8", i: "📊" },
                  { l: t("device.failures"), v: status.publish_failures, c: status.publish_failures > 0 ? "#fbbf24" : "#34d399", i: "⚠️" },
                  { l: t("device.wifiSignal"), v: `${status.wifi_rssi} dBm`, c: getSignal(status.wifi_rssi).color, i: "📶", s: t(getSignal(status.wifi_rssi).tKey) },
                  { l: t("device.freeHeap"), v: `${(status.free_heap / 1024).toFixed(0)} KB`, c: "#34d399", i: "🧠" },
                  { l: t("device.sdUsed"), v: `${status.sd_card.used_mb} MB`, c: "#38bdf8", i: "💾" },
                  { l: t("device.sdBuffered"), v: status.sd_card.buffered, c: status.sd_card.buffered > 0 ? "#fb923c" : "#34d399", i: "📦" },
                  { l: t("device.ntpSync"), v: status.time_synced ? t("device.synced") : t("device.failed"), c: status.time_synced ? "#34d399" : "#ef4444", i: "🕐" },
                ].map(m => (
                  <div key={m.l} style={{ padding: "12px 14px", background: "rgba(6,30,22,0.5)", borderRadius: 14, border: "1px solid rgba(52,211,153,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}><span style={{ fontSize: 11 }}>{m.i}</span><span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2, fontFamily: mono }}>{m.l}</span></div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: sans, letterSpacing: -0.5 }}>{m.v}</div>
                    {m.s && <div style={{ fontSize: 9, color: "#475569", marginTop: 2, fontFamily: mono }}>{m.s}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><span style={{ fontSize: 13 }}>🔧</span><span style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono, letterSpacing: 1, fontWeight: 500 }}>{t("device.architecture").toUpperCase()}</span></div>
              {[
                ["Device ID", status.device], ["Firmware", `v${status.firmware}`], ["Location", status.location],
                [t("device.lastSeen"), new Date(status.last_seen).toLocaleString()], ["MQTT", "89.167.32.214:8883 (TLS)"],
                ["InfluxDB", "89.167.32.214:8086"], ["Interval", "60s data / 5m status"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid rgba(52,211,153,0.04)" }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>{l}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: mono }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: panelBg, border: panelBorder, borderRadius: 20, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><span style={{ fontSize: 13 }}>🛡️</span><span style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono, letterSpacing: 1, fontWeight: 500 }}>{t("device.dataIntegrity").toUpperCase()}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {[
                  { l: t("device.totalReadings"), v: status.readings.toLocaleString(), c: "#38bdf8" },
                  { l: t("device.publishedOk"), v: (status.readings - status.publish_failures).toLocaleString(), c: "#34d399" },
                  { l: t("device.publishFails"), v: status.publish_failures, c: status.publish_failures > 0 ? "#fbbf24" : "#34d399" },
                  { l: t("device.deliveryRate"), v: `${((1 - status.publish_failures / Math.max(1, status.readings)) * 100).toFixed(2)}%`, c: "#34d399" },
                  { l: t("device.sdBuffered"), v: status.sd_card.buffered, c: status.sd_card.buffered > 0 ? "#fb923c" : "#34d399" },
                  { l: t("device.sdFree"), v: `${((1 - status.sd_card.used_mb / status.sd_card.total_mb) * 100).toFixed(1)}%`, c: "#38bdf8" },
                ].map(m => (
                  <div key={m.l} style={{ padding: "14px", background: "rgba(6,30,22,0.5)", borderRadius: 14, border: "1px solid rgba(52,211,153,0.05)" }}>
                    <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, fontFamily: mono }}>{m.l}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: m.c, fontFamily: sans, letterSpacing: -0.5 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
