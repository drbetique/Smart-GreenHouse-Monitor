import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/Login";

// The dashboard and user management are loaded as-is
// Your existing greenhouse-dashboard.jsx becomes the main dashboard view
// Import it once you move it to src/pages/Dashboard.jsx

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(170deg, #010d05, #021a0a, #020617)", color: "#34d399",
        fontFamily: "'DM Sans', sans-serif", fontSize: 14,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const roles = { admin: 3, operator: 2, viewer: 1 };
    if ((roles[user.role] || 0) < (roles[requiredRole] || 0)) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(170deg, #010d05, #021a0a, #020617)", color: "#ef4444",
          fontFamily: "'DM Sans', sans-serif", fontSize: 14,
        }}>
          Insufficient permissions. Required role: {requiredRole}
        </div>
      );
    }
  }

  return children;
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

// Placeholder until you move your dashboard file
function DashboardPlaceholder() {
  const { user, logout, isAdmin } = useAuth();
  return (
    <div style={{
      minHeight: "100vh", padding: 20,
      background: "linear-gradient(170deg, #010d05, #021a0a, #020617)",
      color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 800, margin: "40px auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Dashboard Ready</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>
          Logged in as {user.name} ({user.email}) · Role: {user.role}
        </p>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 24, fontFamily: "'JetBrains Mono', monospace" }}>
          Move your greenhouse-dashboard.jsx to client/src/pages/Dashboard.jsx<br />
          and import it in App.jsx to connect it here.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {isAdmin && (
            <a href="/users" style={{
              padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.2)",
              background: "rgba(52,211,153,0.06)", color: "#34d399", fontSize: 13,
              fontWeight: 600, textDecoration: "none",
            }}>User Management</a>
          )}
          <button onClick={logout} style={{
            padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.06)", color: "#ef4444", fontSize: 13,
            fontWeight: 600, cursor: "pointer",
          }}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// Import these when ready:
// import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/" element={<ProtectedRoute><DashboardPlaceholder /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requiredRole="admin"><UserManagementPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Wrap UserManagement with layout
function UserManagementPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{
      minHeight: "100vh", padding: 20,
      background: "linear-gradient(170deg, #010d05, #021a0a, #020617)",
      color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ fontSize: 28, textDecoration: "none" }}>🌿</a>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Greenhouse Monitor</h1>
              <p style={{ fontSize: 10, color: "#3d6b5a", fontFamily: "'JetBrains Mono', monospace", margin: 0 }}>Admin Panel</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/" style={{ color: "#34d399", fontSize: 12, textDecoration: "none" }}>← Dashboard</a>
            <span style={{ color: "#334155" }}>|</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{user.name}</span>
            <button onClick={logout} style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)",
              background: "transparent", color: "#ef4444", fontSize: 11, cursor: "pointer",
            }}>Sign Out</button>
          </div>
        </div>
        <UserManagement />
      </div>
    </div>
  );
}
