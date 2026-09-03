export const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatRp(n) {
  const v = Math.round(Number(n || 0));
  return "Rp " + v.toLocaleString("de-DE");
}

export function formatNum(n) {
  const v = Number(n || 0);
  if (Number.isInteger(v)) return v.toLocaleString("de-DE");
  return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export function formatDateId(iso) {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${ID_MONTHS[m - 1]} ${y}`;
}

export const TRX_LABEL = { masuk: "Masuk", keluar: "Keluar", retur: "Retur/Sisa" };
export const MODE_LABEL = { per_rim: "Per Rim", per_kg: "Per Kg", total: "Total Kiriman" };
