import { createContext, useContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem("access");
    if (!token) { setLoading(false); return; }

    try {
      const decoded = jwtDecode(token);
      const isExpired = decoded.exp * 1000 < Date.now();

      if (isExpired) {
        // Access token is expired — try a silent refresh before giving up.
        const refresh = localStorage.getItem("refresh");
        if (!refresh) throw new Error("no_refresh");

        const { data: refreshData } = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/auth/token/refresh/`,
            { refresh }
          );

        localStorage.setItem("access", refreshData.access);
        if (refreshData.refresh) {
          localStorage.setItem("refresh", refreshData.refresh);
        }
      }

      // Access token is now valid (either was already, or just refreshed).
      const { data } = await api.get("/auth/me/");
      setUser(data);
    } catch {
      // Token invalid or refresh failed — clear everything and show login.
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);