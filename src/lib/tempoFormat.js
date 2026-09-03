// Helper khusus tool Jatuh Tempo Klien (input nominal bergaya id-ID + bucket tempo).

export const formatNumberInput = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
};

export const parseNumberInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const formatDateLong = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso);
  return `${parseInt(d, 10)} ${MONTHS_ID[parseInt(m, 10) - 1]} ${y}`;
};

export const formatDateShort = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
};

export const todayISO = () => {
  const t = new Date();
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Sisa hari menuju jatuh tempo (negatif = sudah lewat). null bila tanpa tanggal. */
export const daysUntil = (iso) => {
  if (!iso) return null;
  const due = new Date(String(iso).slice(0, 10) + "T00:00:00");
  const now = new Date(todayISO() + "T00:00:00");
  return Math.round((due - now) / 86400000);
};

/** paid | none | overdue | soon (<=3 hari) | warning (<=7 hari) | ok */
export const dueBucket = (iso, status) => {
  if (status === "lunas") return "paid";
  const d = daysUntil(iso);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d <= 3) return "soon";
  if (d <= 7) return "warning";
  return "ok";
};

/** Kelas latar baris tabel sesuai urgensi tempo (aman untuk dark mode). */
export const rowTint = (inv) => {
  const b = dueBucket(inv?.due_date, inv?.status);
  if (b === "overdue") return "bg-rose-500/[0.07] hover:bg-rose-500/[0.12]";
  if (b === "soon" || b === "warning") return "bg-amber-500/[0.07] hover:bg-amber-500/[0.12]";
  return "";
};

export const compactRp = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}rb`;
  return String(n);
};
