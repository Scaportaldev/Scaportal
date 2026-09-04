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
  } catch {}
  try {
    if (typeof window !== "undefined") LEGACY_LOCAL_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}
