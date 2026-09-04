/**
 * Registry route -> loader chunk halaman (satu sumber untuk React.lazy di App.js
 * dan untuk preload).
 *
 * Tujuan: navigasi antar menu terasa instan.
 *  1. Setelah aplikasi siap, semua chunk halaman di-preload saat browser idle
 *     (sekali per sesi, urutan sesuai menu) -> tidak ada skeleton "memuat halaman".
 *  2. Saat pointer hover / fokus / sentuh item menu, chunk + DATA halaman itu
 *     di-prefetch (view mengekspor `prefetch(queryClient)` dengan queryKey yang
 *     sama persis dengan useQuery di dalamnya), jadi saat diklik data sudah di cache.
 */

export const ROUTE_LOADERS = {
  "/stok": () => import("@/views/Dashboard"),
  "/stok/kertas": () => import("@/views/PaperMutations"),
  "/stok/tinta": () => import("@/views/InkMutations"),
  "/stok/lainnya": () => import("@/views/OtherMutations"),
  "/stok/laporan-stok": () => import("@/views/StockReport"),
  "/stok/laporan-detail": () => import("@/views/DetailReport"),
  "/stok/log-user": () => import("@/views/LogsUsers"),
  "/stok/tutup-tahun": () => import("@/views/YearClose"),
  "/hpp": () => import("@/views/hpp/Calculator"),
  "/po": () => import("@/views/po/PoDashboard"),
  "/po/pos": () => import("@/views/po/PoList"),
  "/po/pos/new": () => import("@/views/po/PoForm"),
  "/po/pos/:id": () => import("@/views/po/PoDetail"),
  "/po/kalender": () => import("@/views/po/PoCalendar"),
  "/po/tutup": () => import("@/views/po/PoClose"),
  "/stok-klien": () => import("@/views/klien/Dashboard"),
  "/stok-klien/riwayat": () => import("@/views/klien/History"),
  "/stok-klien/tutup": () => import("@/views/klien/KlienClose"),
  "/tempo": () => import("@/views/tempo/Invoices"),
  "/tempo/laporan": () => import("@/views/tempo/Reports"),
  "/tidak-ada-akses": () => import("@/views/NoAccess"),
};

const chunkPromises = new Map(); // path -> Promise<module>
const dataWarmedAt = new Map();  // path -> timestamp prefetch data terakhir
const DATA_WARM_COOLDOWN_MS = 20_000; // jangan spam prefetch saat hover bolak-balik

/** Muat chunk halaman (idempoten). */
export function preloadRoute(path) {
  const loader = ROUTE_LOADERS[path];
  if (!loader) return Promise.resolve(null);
  if (!chunkPromises.has(path)) {
    const p = loader().catch((e) => { chunkPromises.delete(path); throw e; });
    chunkPromises.set(path, p);
  }
  return chunkPromises.get(path);
}

/** Muat chunk + prefetch data halaman (bila view mengekspor `prefetch`). */
export async function warmRoute(path, queryClient) {
  let mod = null;
  try { mod = await preloadRoute(path); } catch { return; }
  if (!queryClient || typeof mod?.prefetch !== "function") return;
  const last = dataWarmedAt.get(path) || 0;
  if (Date.now() - last < DATA_WARM_COOLDOWN_MS) return;
  dataWarmedAt.set(path, Date.now());
  try { await mod.prefetch(queryClient); } catch { /* prefetch best-effort */ }
}

let allScheduled = false;
/**
 * Preload SEMUA chunk (tanpa data) saat browser idle, satu per satu agar tidak
 * bersaing dengan render halaman aktif. Dipanggil sekali setelah login.
 */
export function preloadAllRoutesWhenIdle(paths = Object.keys(ROUTE_LOADERS)) {
  if (allScheduled || typeof window === "undefined") return;
  allScheduled = true;
  const queue = [...paths];
  const idle = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
    : (cb) => setTimeout(cb, 200);
  const step = () => {
    const next = queue.shift();
    if (!next) return;
    preloadRoute(next).catch(() => {}).finally(() => idle(step));
  };
  idle(step);
}
