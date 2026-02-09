import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing token on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      api.me()
        .then(data => setUser(data.user))
        .catch(() => { clearToken(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";
  const isOperator = user?.role === "operator" || isAdmin;
  const isViewer = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isOperator, isViewer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
