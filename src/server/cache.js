/**
 * Cache in-memory sederhana untuk hasil agregasi berat (Dashboard, Laporan Stok,
 * dropdown jenis, PO dashboard, dst.).
 *
 * Aturan:
 *  - Entri punya TTL (default 60 dtk, env CACHE_TTL_MS) sebagai batas maksimum kebasian
 *    (mis. bila data diubah langsung lewat phpMyAdmin).
 *  - Setiap TULIS lewat aplikasi memanggil invalidate(tag) sehingga pembaca berikutnya
 *    langsung menghitung ulang -> hasil selalu segar setelah perubahan lewat aplikasi.
 *  - Permintaan paralel untuk key yang sama saat cache kosong dibagi 1 promise (dedupe).
 *  - Disimpan di globalThis supaya hot-reload Next.js tidak mereset cache tiap modul dievaluasi.
 *  - Coolify menjalankan 1 instance Next.js, jadi cache proses tunggal aman.
 *    Matikan dengan CACHE_DISABLED=1 bila nanti dijalankan multi-instance.
 */
const g = globalThis;
if (!g.__scaCache) g.__scaCache = { store: new Map(), hits: 0, misses: 0 };
const C = g.__scaCache;

const DISABLED = process.env.CACHE_DISABLED === "1";
export const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS || 60_000);

const fullKey = (tag, key) => `${tag}:${key}`;

/**
 * Ambil dari cache atau hitung lewat fn().
 * @param {string} tag   kelompok invalidasi (mis. "stok", "po")
 * @param {string} key   kunci unik dalam tag
 * @param {() => Promise<any>} fn
 * @param {number} ttlMs
 */
export async function cached(tag, key, fn, ttlMs = DEFAULT_TTL_MS) {
  if (DISABLED) return await fn();
  const k = fullKey(tag, key);
  const now = Date.now();
  const hit = C.store.get(k);
  if (hit) {
    if (hit.promise) return await hit.promise; // sedang dihitung oleh request lain
    if (hit.expires > now) { C.hits++; return hit.value; }
    C.store.delete(k);
  }
  C.misses++;
  const promise = (async () => {
    try {
      const value = await fn();
      // Simpan hanya bila belum di-invalidate selama perhitungan berjalan.
      const cur = C.store.get(k);
      if (cur && cur.promise === promise) C.store.set(k, { value, expires: Date.now() + ttlMs });
      return value;
    } catch (e) {
      const cur = C.store.get(k);
      if (cur && cur.promise === promise) C.store.delete(k);
      throw e;
    }
  })();
  C.store.set(k, { promise });
  return await promise;
}

/** Hapus semua entri untuk tag tertentu (dipanggil setelah tulis). */
export function invalidate(...tags) {
  for (const tag of tags) {
    const prefix = `${tag}:`;
    for (const k of C.store.keys()) if (k.startsWith(prefix)) C.store.delete(k);
  }
}

export function invalidateAll() { C.store.clear(); }

export function cacheStats() {
  return { size: C.store.size, hits: C.hits, misses: C.misses, ttl_ms: DEFAULT_TTL_MS, disabled: DISABLED };
}

// Tag yang dipakai aplikasi
export const TAG_STOK = "stok"; // paper/ink/other mutations -> dashboard, laporan, jenis, refs
export const TAG_PO = "po";     // pos, po_schedules, po_files
