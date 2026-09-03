// Format helpers dipakai lintas modul (Stok, HPP, PO).
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

export const n = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const x = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return isNaN(x) ? 0 : x;
};

export const parseGsm = (s) => {
  const m = String(s || "").match(/\d+/);
  return m ? parseFloat(m[0]) : 0;
};

export const parseUkuran = (s) => {
  const m = String(s || "").match(/(\d+[.,]?\d*)\s*[xX]\s*(\d+[.,]?\d*)/);
  if (!m) return [0, 0];
  return [parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))];
};

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const formatRp = (v) => "Rp " + idr.format(n(v));

/**
 * Rupiah ringkas untuk ruang sempit (tengah donut, baris legend, kartu KPI).
 * Contoh: 4.966.225.676 -> "Rp 4,97 M" | 102.592.643 -> "Rp 102,6 Jt".
 * Nominal persisnya tetap ditampilkan lewat formatRupiah di tempat yang lega.
 */
export const formatRupiahCompact = (v) => {
  const num = n(v);
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  const fmt = (val, digits) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(val);

  if (abs >= 1e12) return `${sign}Rp ${fmt(abs / 1e12, 2)} T`;
  if (abs >= 1e9) return `${sign}Rp ${fmt(abs / 1e9, 2)} M`;
  if (abs >= 1e6) return `${sign}Rp ${fmt(abs / 1e6, 1)} Jt`;
  if (abs >= 1e3) return `${sign}Rp ${fmt(abs / 1e3, 0)} Rb`;
  return `${sign}Rp ${fmt(abs, 0)}`;
};

export const formatNum = (v, digits = 2) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n(v));

export const formatGroup = (v) => {
  if (v === "" || v === null || v === undefined) return "";
  const num = n(v);
  if (num === 0 && String(v).trim() === "") return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 }).format(num);
};

export function formatCurrency(v) {
  return formatRp(v);
}

export function formatDateID(iso) {
  if (!iso) return "-";
  try { return dayjs(iso).format("DD MMM YYYY"); } catch { return "-"; }
}

export function formatDateTimeID(iso) {
  if (!iso) return "-";
  try { return dayjs(iso).format("DD MMM YYYY HH:mm"); } catch { return "-"; }
}

export function fmtDate(v) {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  }
  return String(v);
}

export function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}.${p(d.getMinutes())}`;
}

// ---- Backward-compat aliases (dipakai kode Stok existing) ----
export const formatRupiah = formatRp;
export const formatNumber = (v, digits = 0) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n(v));

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Label jenis transaksi. Kunci HARUS sama dengan nilai yang dipakai backend
// (lihat src/server/format.js): masuk | keluar | retur.
export const TRX_LABEL = { masuk: "Masuk", keluar: "Keluar", retur: "Retur/Sisa" };

