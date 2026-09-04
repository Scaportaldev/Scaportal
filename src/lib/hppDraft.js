/**
 * Draft Kalkulator HPP disimpan di sessionStorage supaya isian yang BELUM
 * ditekan "Simpan" tidak hilang saat user berpindah menu lalu kembali
 * (komponen di-unmount saat ganti route). Draft ikut hilang saat tab ditutup
 * atau saat logout — tidak pernah dikirim ke server.
 */
const PREFIX = "sca_hpp_draft";

const key = (userId) => `${PREFIX}:${userId || "anon"}`;

export function readHppDraft(userId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeHppDraft(userId, draft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(userId), JSON.stringify(draft));
  } catch { /* storage penuh / private mode: abaikan */ }
}

export function clearHppDraft(userId) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(key(userId)); } catch {}
}

/** Hapus semua draft HPP (dipanggil saat logout). */
export function clearAllHppDrafts() {
  if (typeof window === "undefined") return;
  try {
    const ss = window.sessionStorage;
    const keys = [];
    for (let i = 0; i < ss.length; i++) {
      const k = ss.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ss.removeItem(k));
  } catch {}
}
