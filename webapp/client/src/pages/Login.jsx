import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const mono = "'JetBrains Mono', monospace";
const sans = "'DM Sans', sans-serif";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: "1px solid rgba(52,211,153,0.12)", background: "rgba(15,23,42,0.6)",
    color: "#e2e8f0", fontSize: 14, fontFamily: sans, outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(170deg, #010d05 0%, #021a0a 25%, #0a1628 50%, #020617 100%)",
      padding: 20, position: "relative", overflow: "hidden",
    }}>
      <svg style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.02 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lp" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M20,60 Q40,20 60,60 Q40,40 20,60Z" fill="#10b981" />
            <path d="M80,30 Q95,10 100,30 Q90,25 80,30Z" fill="#059669" />
            <path d="M50,90 Q70,70 90,90 Q70,80 50,90Z" fill="#10b981" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp)" />
      </svg>

      <div style={{ position: "fixed", top: "-30%", right: "-20%", width: "70vw", height: "70vw", background: "radial-gradient(circle, rgba(52,211,153,0.04) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #059669, #10b981, #34d399)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
            boxShadow: "0 8px 32px rgba(16,185,129,0.25)",
          }}>🌿</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", fontFamily: sans, margin: 0, letterSpacing: -0.5 }}>
            Greenhouse Monitor
          </h1>
          <p style={{ fontSize: 12, color: "#3d6b5a", fontFamily: mono, marginTop: 6, letterSpacing: 0.5 }}>
            HAMK Lepaa · IoT Sensor Dashboard
          </p>
        </div>

        <div style={{
          background: "linear-gradient(145deg, rgba(6,30,22,0.85), rgba(15,23,42,0.92))",
          border: "1px solid rgba(52,211,153,0.1)", borderRadius: 24, padding: 32,
          boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1", marginBottom: 24, textAlign: "center" }}>Sign In</h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", fontFamily: mono, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(52,211,153,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(52,211,153,0.12)"} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", fontFamily: mono, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password" required style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(52,211,153,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(52,211,153,0.12)"} />
            </div>

            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444", fontSize: 12, fontFamily: sans,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
              background: loading ? "#1e3a2e" : "linear-gradient(135deg, #059669, #10b981)",
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer",
              fontFamily: sans, transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 4px 16px rgba(16,185,129,0.25)",
            }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div style={{
          marginTop: 20, padding: "14px 18px", borderRadius: 14,
          background: "rgba(6,30,22,0.4)", border: "1px solid rgba(52,211,153,0.06)",
          fontSize: 11, color: "#3d6b5a", fontFamily: mono, lineHeight: 1.6, textAlign: "center",
        }}>
          Need an account? Contact your system administrator.
        </div>
      </div>
    </div>
  );
}
