/**
 * Invalidasi cache react-query setelah TULIS — satu tempat supaya dependensi lintas
 * halaman tidak terlewat (mis. tambah mutasi kertas harus menyegarkan Dashboard,
 * Laporan Stok, dan Log Audit; simpan PO harus menyegarkan Daftar & Dashboard PO).
 *
 * Dipakai bersama `staleTime` global (ClientApp.jsx): pindah-pindah menu dalam jendela
 * stale tidak memanggil server, tapi setelah aksi simpan data langsung diambil ulang.
 */

/** Semua query yang bergantung pada tabel mutasi stok (paper/ink/other). */
export const STOK_QUERY_KEYS = [
  ["mutations"], ["jenis"], ["refs"], ["dashboard"], ["reports"], ["logs"],
];

export function invalidateStok(queryClient) {
  for (const key of STOK_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: key });
}

export function invalidatePo(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["po"] });
}

export function invalidateKlien(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["klien"] });
}

export function invalidateTempo(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["tempo"] });
}

export function invalidateUsers(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["users"] });
  queryClient.invalidateQueries({ queryKey: ["logs"] });
}

/** Tutup Tahun & sejenisnya: segarkan semuanya. */
export function invalidateEverything(queryClient) {
  queryClient.invalidateQueries();
}
