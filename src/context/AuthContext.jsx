import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import api, { setSectionPassword, setUnauthorizedHandler } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { effectivePermissions } from "@/lib/permissions";
import { clearAllHppDrafts } from "@/lib/hppDraft";
import {
  setToken, hasTabSession, markTabSession, touchActivity, isIdleExpired, clearClientSession,
} from "@/lib/session";

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
  const queryClient = useQueryClient();
  const [user, setUser] = useState(undefined); // undefined=loading, null=guest
  const [sectionUnlocked, setSectionUnlocked] = useState(false);

  // Bersihkan sesi di klien + minta server hapus cookie (tanpa mengubah state React).
  const dropSession = useCallback(async (type) => {
    try { await api.post("/auth/logout", { type }); } catch {}
    clearClientSession();
    clearAllHppDrafts();
    queryClient.clear();
    setSectionPassword("");
  }, [queryClient]);

  const loadMe = useCallback(async () => {
    // Kebijakan sesi:
    //  - Tab baru / tab ditutup lalu dibuka lagi → tidak ada penanda sesi tab → WAJIB login ulang
    //    walau cookie server masih berlaku (cookie dibersihkan lewat /auth/logout).
    //  - Tidak ada aktivitas > 30 menit (termasuk saat tab di-background / reload) → logout otomatis.
    if (typeof window !== "undefined") {
      if (!hasTabSession()) {
        await dropSession("auto");
        setUser(null);
        return;
      }
      if (isIdleExpired()) {
        await dropSession("auto");
        setUser(null);
        return;
      }
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      touchActivity();
      if (data.role === "superadmin") setSectionUnlocked(true);
    } catch {
      clearClientSession();
      setUser((prev) => (prev === undefined ? null : prev));
    }
  }, [dropSession]);

  useEffect(() => { loadMe(); }, [loadMe]);

  // Server menjawab 401 di tengah pemakaian (token kedaluwarsa / dicabut) → langsung ke login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear();
      setSectionPassword("");
      setSectionUnlocked(false);
      setUser((prev) => (prev ? null : prev));
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  // Login hanya username + password; role & hak akses datang dari server.
  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    queryClient.clear(); // sesi baru: jangan pakai cache milik sesi/user sebelumnya
    clearClientSession();
    if (data.token) setToken(data.token);
    markTabSession();
    touchActivity();
    setUser(data);
    if (data.role === "superadmin") setSectionUnlocked(true);
    return data;
  };

  const logout = async (type = "manual") => {
    await dropSession(type);
    setUser(null);
    setSectionUnlocked(false);
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
