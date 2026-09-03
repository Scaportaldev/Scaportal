/**
 * Definisi hak akses per-user (dipakai server & klien).
 *
 * - Superadmin SELALU punya semua akses; toggle-nya terkunci ON dan tidak bisa diubah.
 * - User lain (role `admin`) aksesnya ditentukan toggle per-tools yang disimpan di
 *   kolom JSON `users.permissions`. Default: semua OFF.
 * - Tools yang OFF: menu hilang dari sidebar, route di-redirect, API balas 403.
 */

export const PERMISSION_GROUPS = [
  {
    key: "stok",
    label: "Stok SCA",
    description: "Dashboard, Mutasi Kertas/Tinta/Lain, Laporan Stok",
    children: [
      { key: "stok_detail", label: "Laporan Detail & nominal harga", description: "Nilai rupiah stok, laporan detail, rekap PPN" },
      { key: "stok_pdf", label: "Download PDF laporan", description: "Ekspor PDF mutasi & laporan stok" },
      { key: "stok_tutup_tahun", label: "Tutup Tahun", description: "Reset seluruh data mutasi tahun berjalan" },
    ],
  },
  { key: "po", label: "PO Tracker", description: "Dashboard PO, daftar PO, tahapan produksi, kalender" },
  { key: "klien", label: "Stok Klien", description: "Stok barang titipan klien & riwayat mutasi" },
  { key: "tempo", label: "Jatuh Tempo Klien", description: "Invoice, cicilan, laporan piutang (berisi nominal rupiah)" },
  { key: "hpp", label: "Kalkulator HPP", description: "Perhitungan harga pokok produksi" },
  { key: "logs", label: "Log Aktivitas & Audit", description: "Riwayat login/logout dan audit edit/hapus (manajemen user tetap khusus Superadmin)" },
];

/** Semua key permission (induk + anak) dalam urutan tampil. */
export const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => [g.key, ...(g.children || []).map((c) => c.key)]);

/** Peta anak -> induk (anak hanya berlaku bila induknya ON). */
export const PERMISSION_PARENT = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => (g.children || []).map((c) => [c.key, g.key])),
);

export function emptyPermissions() {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));
}

export function fullPermissions() {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
}

/**
 * Normalisasi input bebas (dari DB / body request) menjadi objek lengkap {key: boolean}.
 * Key tak dikenal dibuang; anak dipaksa OFF bila induknya OFF.
 */
export function normalizePermissions(input) {
  const out = emptyPermissions();
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const k of PERMISSION_KEYS) {
      if (k in input) out[k] = input[k] === true || input[k] === 1 || input[k] === "1" || input[k] === "true";
    }
  }
  for (const [child, parent] of Object.entries(PERMISSION_PARENT)) {
    if (!out[parent]) out[child] = false;
  }
  return out;
}

/** Permission efektif user: superadmin = semua ON. */
export function effectivePermissions(user) {
  if (!user) return emptyPermissions();
  if (user.role === "superadmin") return fullPermissions();
  return normalizePermissions(user.permissions);
}

export function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  return !!effectivePermissions(user)[key];
}

/** Label singkat untuk badge ringkasan di tabel user. */
export function permissionLabels(perms) {
  const p = normalizePermissions(perms);
  return PERMISSION_GROUPS.filter((g) => p[g.key]).map((g) => g.label);
}
