const BASE = "/api";

function getToken() {
  return localStorage.getItem("gh_token");
}

function setToken(token) {
  localStorage.setItem("gh_token", token);
}

function clearToken() {
  localStorage.removeItem("gh_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const data = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : await res.text();

  if (!res.ok) throw new Error(data.error || data || "Request failed");
  return data;
}

// Auth
export const api = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: () => request("/auth/me"),

  changePassword: (currentPassword, newPassword) =>
    request("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),

  // User management (admin)
  getUsers: () => request("/auth/users"),

  createUser: (email, password, name, role) =>
    request("/auth/users/create", { method: "POST", body: JSON.stringify({ email, password, name, role }) }),

  updateRole: (userId, role) =>
    request(`/auth/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),

  updateStatus: (userId, active) =>
    request(`/auth/users/${userId}/status`, { method: "PUT", body: JSON.stringify({ active }) }),

  deleteUser: (userId) =>
    request(`/auth/users/${userId}`, { method: "DELETE" }),

  // Sensor data
  getSensors: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/data/sensors?${qs}`);
  },

  getLatest: () => request("/data/latest"),
  getStatus: () => request("/data/status"),

  exportCSV: (start, end) => {
    const qs = new URLSearchParams({ start, end }).toString();
    return request(`/data/export?${qs}`);
  },

  // Alerts
  getAlertConfig: () => request("/data/alerts/config"),

  updateAlertConfig: (configs) =>
    request("/data/alerts/config", { method: "PUT", body: JSON.stringify({ configs }) }),

  getAlertHistory: (limit = 50) => request(`/data/alerts/history?limit=${limit}`),
};

export { getToken, setToken, clearToken };
