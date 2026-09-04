/**
 * Kebijakan sesi SCA Portal (sisi klien):
 *  1. Sesi terikat pada TAB: token & penanda sesi disimpan di sessionStorage.
 *     Tab ditutup → sesi hilang → wajib login ulang (walau cookie server masih ada,
 *     AuthContext akan memaksa logout bila penanda tab tidak ditemukan).
 *  2. Idle timeout 30 menit: waktu aktivitas terakhir disimpan di sessionStorage
 *     sehingga tetap terhitung walau tab di-background (timer JS dibekukan di
 *     tablet/mobile) atau halaman di-reload.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_WARN_MS = 28 * 60 * 1000;

const TOKEN_KEY = "sca_token";
const TAB_KEY = "sca_tab_session";
const ACTIVITY_KEY = "sca_last_activity";
const LEGACY_LOCAL_KEYS = ["sca_token", "stokku_token"];

const ss = () => (typeof window !== "undefined" ? window.sessionStorage : null);

export function getToken() {
  try { return ss()?.getItem(TOKEN_KEY) || null; } catch { return null; }
}

export function setToken(token) {
  try { if (token) ss()?.setItem(TOKEN_KEY, token); } catch {}
}

/** Penanda bahwa tab ini sudah punya sesi login yang sah. */
export function hasTabSession() {
  try { return ss()?.getItem(TAB_KEY) === "1"; } catch { return false; }
}

export function markTabSession() {
  try { ss()?.setItem(TAB_KEY, "1"); } catch {}
}

export function touchActivity(now = Date.now()) {
  try { ss()?.setItem(ACTIVITY_KEY, String(now)); } catch {}
}

export function getLastActivity() {
  try {
    const v = Number(ss()?.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

/** true bila sudah lewat 30 menit sejak aktivitas terakhir yang tercatat. */
export function isIdleExpired(now = Date.now()) {
  const last = getLastActivity();
  if (!last) return false;
  return now - last > IDLE_TIMEOUT_MS;
}

/** Bersihkan semua jejak sesi di klien (dipanggil saat logout / sesi kedaluwarsa). */
export function clearClientSession() {
  try {
    const s = ss();
    s?.removeItem(TOKEN_KEY);
    s?.removeItem(TAB_KEY);
    s?.removeItem(ACTIVITY_KEY);
    s?.removeItem(CLOSED_KEY);
    s?.removeItem(ALIVE_KEY);
  } catch {}
  try {
    if (typeof window !== "undefined") LEGACY_LOCAL_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}

// ---------------------------------------------------------------------------
// Deteksi "tab ditutup lalu dipulihkan browser" — ABSOLUT: tab ditutup = login ulang.
// Chrome/Safari (terutama Android & iPad) MEMULIHKAN sessionStorage saat tab yang
// ditutup dibuka lagi ("buka tab yang baru ditutup") atau saat browser dibuka
// ulang, sehingga penanda sesi tab ikut hidup lagi. Penanganan:
//  - saat tab ditutup (pagehide, bukan bfcache) → catat CLOSED_KEY = waktu tutup;
//  - selama tab terlihat → catat ALIVE_KEY tiap 5 detik (detak hidup).
// Saat aplikasi dimuat ulang dengan penanda sesi tab yang masih ada:
//  - CLOSED_KEY lebih tua dari RELOAD_GRACE → tab dipulihkan (bukan reload) → login ulang;
//  - tanpa CLOSED_KEY (proses browser dimatikan paksa tanpa pagehide) tapi detak
//    terakhir lebih tua dari ALIVE_STALE → tab sempat mati → login ulang.
// Reload biasa (Ctrl+R / tarik ke bawah) selesai dalam hitungan detik → tetap login.
// ---------------------------------------------------------------------------
const CLOSED_KEY = "sca_tab_closed_at";
const ALIVE_KEY = "sca_tab_alive_at";
const RELOAD_GRACE_MS = 10 * 1000;
const ALIVE_STALE_MS = 30 * 1000;
export const ALIVE_BEAT_MS = 5 * 1000;

export function markTabClosed(now = Date.now()) {
  try { ss()?.setItem(CLOSED_KEY, String(now)); } catch {}
}

export function clearTabClosed() {
  try { ss()?.removeItem(CLOSED_KEY); } catch {}
}

export function beatAlive(now = Date.now()) {
  try { ss()?.setItem(ALIVE_KEY, String(now)); } catch {}
}

function readTs(key) {
  try {
    const v = Number(ss()?.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

/**
 * true bila tab ini sebelumnya sudah DITUTUP (atau mati) dan kini dipulihkan browser,
 * sehingga sesi tidak boleh dilanjutkan. Dipanggil sekali saat aplikasi dimuat.
 */
export function wasTabClosed(now = Date.now()) {
  const closedAt = readTs(CLOSED_KEY);
  if (closedAt) return now - closedAt > RELOAD_GRACE_MS;
  const aliveAt = readTs(ALIVE_KEY);
  if (aliveAt) return now - aliveAt > ALIVE_STALE_MS;
  return false;
}

/**
 * Pasang pemantau siklus hidup tab (pagehide/pageshow/visibility + detak 5 detik).
 * Mengembalikan fungsi pembersih.
 */
export function installTabLifecycle() {
  if (typeof window === "undefined") return () => {};
  const onPageHide = (e) => { if (!e.persisted) markTabClosed(); else clearTabClosed(); };
  const onPageShow = (e) => { if (e.persisted) { clearTabClosed(); beatAlive(); } };
  const onVisibility = () => { if (document.visibilityState === "visible") beatAlive(); };
  const timer = setInterval(() => { if (document.visibilityState === "visible") beatAlive(); }, ALIVE_BEAT_MS);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibility);
  clearTabClosed();
  beatAlive();
  return () => {
    clearInterval(timer);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
