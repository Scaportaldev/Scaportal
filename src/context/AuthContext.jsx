import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import api, { setSectionPassword } from "@/lib/api";
import { effectivePermissions } from "@/lib/permissions";

const AuthContext = createContext(null);

export function apiError(e, fallback = "Terjadi kesalahan. Coba lagi.") {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (d?.msg) return d.msg;
  return String(d);
}

/**
 * Urutan halaman "beranda" berdasarkan toggle yang ON. Dipakai untuk redirect
 * setelah login dan saat user membuka route yang tidak diizinkan.
 */
export function homePathFor(perms) {
  if (!perms) return "/login";
  if (perms.canStok) return "/stok";
  if (perms.canPo) return "/po";
  if (perms.canStokKlien) return "/stok-klien";
  if (perms.canTempo) return "/tempo";
  if (perms.canHpp) return "/hpp";
  if (perms.canStokLogs) return "/stok/log-user";
  return "/tidak-ada-akses";
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

  // Login hanya username + password; role & hak akses datang dari server.
  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
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

  // Permission efektif: superadmin semua ON, user lain sesuai toggle dari server.
  const perms = useMemo(() => {
    const p = effectivePermissions(user);
    const on = (k) => !!user && !!p[k];
    return {
      raw: p,
      canStok: on("stok"),
      canStokDashboard: on("stok"),
      canStokMutations: on("stok"),
      canStokReport: on("stok"),
      canStokDetail: on("stok_detail"),      // Laporan Detail + semua nominal rupiah Stok SCA
      canStokPdf: on("stok_pdf"),            // Tombol download PDF di Stok SCA
      canStokYearClose: on("stok_tutup_tahun"),
      canStokLogs: on("logs"),               // Log aktivitas & audit
      canHpp: on("hpp"),
      canPo: on("po"),
      canStokKlien: on("klien"),
      canTempo: on("tempo"),
      canUsers: isSuper,                     // Manajemen user tetap khusus Superadmin
    };
  }, [user, isSuper]);

  const homePath = homePathFor(user ? perms : null);

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, sectionUnlocked, unlockSection, perms, isSuper, homePath }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
