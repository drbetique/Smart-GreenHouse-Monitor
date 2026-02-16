import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { api } from "../api";

const mono = "'JetBrains Mono', monospace";
const sans = "'DM Sans', sans-serif";

const roleBadge = {
  admin: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", color: "#ef4444" },
  operator: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", color: "#fbbf24" },
  viewer: { bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)", color: "#60a5fa" },
};

export default function UserManagement() {
  const { user: currentUser, isAdmin } = useAuth();
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", role: "viewer" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      await api.createUser(newUser.email, newUser.password, newUser.name, newUser.role);
      setNewUser({ email: "", password: "", name: "", role: "viewer" });
      setShowCreate(false);
      setSuccess(t("users.created"));
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setError(""); setSuccess("");
    try {
      await api.updateRole(userId, role);
      setSuccess(t("users.roleUpdated"));
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (userId, active) => {
    try {
      await api.updateStatus(userId, !active);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (userId, email) => {
    if (!confirm(t("users.confirmDelete").replace("{email}", email))) return;
    try {
      await api.deleteUser(userId);
      setSuccess(t("users.deleted"));
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isAdmin) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>{t("users.adminRequired")}</div>;
  }

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(52,211,153,0.12)", background: "rgba(15,23,42,0.6)",
    color: "#e2e8f0", fontSize: 13, fontFamily: sans, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{t("users.title")}</h2>
          <p style={{ fontSize: 11, color: "#475569", fontFamily: mono, margin: "4px 0 0" }}>{users.length} {t("users.subtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.25)",
          background: showCreate ? "rgba(52,211,153,0.12)" : "transparent",
          color: "#34d399", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: sans,
        }}>
          {showCreate ? t("users.cancel") : t("users.create")}
        </button>
      </div>

      {/* Messages */}
      {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12 }}>{error}</div>}
      {success && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: 12 }}>{success}</div>}

      {/* Create user form */}
      {showCreate && (
        <div style={{
          padding: 20, borderRadius: 16,
          background: "linear-gradient(145deg, rgba(6,30,22,0.85), rgba(15,23,42,0.92))",
          border: "1px solid rgba(52,211,153,0.1)",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1", marginBottom: 16 }}>{t("users.createTitle")}</h3>
          <form onSubmit={handleCreateUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#475569", fontFamily: mono, marginBottom: 4, textTransform: "uppercase" }}>{t("users.name")}</label>
              <input type="text" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} required style={inputStyle} placeholder={t("users.placeholder.name")} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#475569", fontFamily: mono, marginBottom: 4, textTransform: "uppercase" }}>{t("users.email")}</label>
              <input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} required style={inputStyle} placeholder={t("users.placeholder.email")} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#475569", fontFamily: mono, marginBottom: 4, textTransform: "uppercase" }}>{t("login.password")}</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required minLength={8} style={inputStyle} placeholder={t("users.placeholder.password")} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#475569", fontFamily: mono, marginBottom: 4, textTransform: "uppercase" }}>{t("users.role")}</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="viewer">{t("role.viewer")}</option>
                <option value="operator">{t("role.operator")}</option>
                <option value="admin">{t("role.admin")}</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" style={{
                padding: "10px 24px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: sans,
              }}>{t("users.createSubmit")}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div style={{
        borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(145deg, rgba(6,30,22,0.85), rgba(15,23,42,0.92))",
        border: "1px solid rgba(52,211,153,0.08)",
      }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.2fr", gap: 8, padding: "12px 18px", borderBottom: "1px solid rgba(148,163,184,0.06)", fontSize: 10, fontFamily: mono, color: "#475569", textTransform: "uppercase", letterSpacing: 1 }}>
          <div>{t("users.name")}</div><div>{t("users.email")}</div><div>{t("users.role")}</div><div>{t("users.status")}</div><div>{t("users.actions")}</div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#475569", fontSize: 12 }}>{t("users.loading")}</div>
        ) : (
          users.map(u => {
            const isSelf = u.id === currentUser?.id;
            const rb = roleBadge[u.role];
            return (
              <div key={u.id} style={{
                display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.2fr", gap: 8,
                padding: "14px 18px", alignItems: "center",
                borderBottom: "1px solid rgba(148,163,184,0.03)",
                opacity: u.active ? 1 : 0.5,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                    {u.name} {isSelf && <span style={{ fontSize: 10, color: "#34d399" }}>{t("users.you")}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#475569", fontFamily: mono }}>
                    {u.last_login ? `${t("users.lastLogin")}: ${new Date(u.last_login).toLocaleDateString()}` : t("users.neverLoggedIn")}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono }}>{u.email}</div>
                <div>
                  {isSelf ? (
                    <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, background: rb.bg, border: `1px solid ${rb.border}`, color: rb.color }}>{t(`role.${u.role}`)}</span>
                  ) : (
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={{
                      padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: rb.bg, border: `1px solid ${rb.border}`, color: rb.color,
                      cursor: "pointer", outline: "none", fontFamily: sans,
                    }}>
                      <option value="viewer">{t("role.viewer")}</option>
                      <option value="operator">{t("role.operator")}</option>
                      <option value="admin">{t("role.admin")}</option>
                    </select>
                  )}
                </div>
                <div>
                  <span style={{
                    padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                    background: u.active ? "rgba(52,211,153,0.1)" : "rgba(148,163,184,0.1)",
                    color: u.active ? "#34d399" : "#64748b",
                  }}>
                    {u.active ? t("users.active") : t("users.disabled")}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {!isSelf && (
                    <>
                      <button onClick={() => handleToggleActive(u.id, u.active)} style={{
                        padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
                        border: "1px solid rgba(148,163,184,0.12)", background: "rgba(15,23,42,0.5)",
                        color: u.active ? "#fbbf24" : "#34d399", fontFamily: sans,
                      }}>
                        {u.active ? t("users.disable") : t("users.enable")}
                      </button>
                      <button onClick={() => handleDelete(u.id, u.email)} style={{
                        padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
                        border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.05)",
                        color: "#ef4444", fontFamily: sans,
                      }}>
                        {t("users.delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
