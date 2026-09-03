import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setSectionPassword } from "@/lib/api";

const AuthContext = createContext(null);

export function apiError(e, fallback = "Terjadi kesalahan. Coba lagi.") {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (d?.msg) return d.msg;
  return String(d);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=guest
  const [sectionUnlocked, setSectionUnlocked] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      if (data.role === "superadmin") setSectionUnlocked(true);
    } catch {
      setUser((prev) => (prev === undefined ? null : prev));
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (username, password, role) => {
    const { data } = await api.post("/auth/login", { username, password, role });
    if (data.token) {
      localStorage.setItem("stokku_token", data.token);
      localStorage.setItem("sca_token", data.token);
    }
    setUser(data);
    if (data.role === "superadmin") setSectionUnlocked(true);
    return data;
  };

  const logout = async (type = "manual") => {
    try { await api.post("/auth/logout", { type }); } catch {}
    localStorage.removeItem("sca_token");
    localStorage.removeItem("stokku_token");
    setUser(null);
    setSectionUnlocked(false);
    setSectionPassword("");
  };

  const unlockSection = async (password) => {
    await api.post("/auth/verify-temp-password", { password });
    setSectionPassword(password);
    setSectionUnlocked(true);
    return true;
  };

  const isSuper = user?.role === "superadmin";
  const perms = {
    canStokDashboard: !!user,
    canStokMutations: !!user,
    canStokReport: !!user,
    canStokDetail: isSuper,     // Admin/PIC TIDAK bisa akses Laporan Detail
    canStokLogs: isSuper,       // via section-lock existing (Superadmin bebas)
    canStokYearClose: isSuper,
    canHpp: isSuper,            // HPP HANYA Superadmin
    canPo: !!user,              // PO Tracker semua role
    canStokKlien: !!user,       // Stok Klien: Superadmin + Admin/PIC
    canTempo: isSuper,          // Jatuh Tempo Klien HANYA Superadmin (berisi nominal Rupiah)
    canUsers: isSuper,          // Register user hanya Superadmin
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, sectionUnlocked, unlockSection, perms }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
