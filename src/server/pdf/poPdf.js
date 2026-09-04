/** PDF Rekap PO — memakai infrastruktur pdf-lib yang sama dengan laporan Tutup Tahun (core.js). */
import { createDoc, docHeader, section, drawTable, text, C, finish, ensure } from "@/server/pdf/core";
import { computeStatus } from "@/server/po/stages";

const BUCKET_LABELS = {
  waiting_1: "Menunggu Tahap 1", waiting_2: "Menunggu Tahap 2", waiting_3: "Menunggu Tahap 3",
  stage_4: "Potong Kertas", stage_5: "Proses Cetak", stage_6: "Finishing", stage_7: "Proses Plong",
  stage_8: "Proses Kopek", stage_9: "Proses Lem", stage_10: "Packing", printing: "Finalisasi Cetak",
  print_done_not_shipped: "Selesai Cetak, Belum Kirim", delivery_failed: "Gagal Kirim",
  completed: "Selesai & Terkirim", no_stages: "Tanpa Tahapan", unknown: "-",
};
const MONTH_NAMES = {
  "01": "Januari", "02": "Februari", "03": "Maret", "04": "April", "05": "Mei", "06": "Juni",
  "07": "Juli", "08": "Agustus", "09": "September", "10": "Oktober", "11": "November", "12": "Desember",
};

function fmtDate(s) {
  if (!s) return "-";
  const str = String(s).slice(0, 10);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : str;
}

function poMonth(po) {
  const d = po.po_date || po.est_start || "";
  return d.length >= 7 ? d.slice(0, 7) : "";
}

function monthLabel(mk) {
  if (!mk || mk.length < 7) return "Tanpa Tanggal";
  const y = mk.slice(0, 4);
  const m = mk.slice(5, 7);
  return `${MONTH_NAMES[m] || m} ${y}`;
}

export async function buildPoRekapPdf({ pos, month }) {
  const ctx = await createDoc({ landscape: true });
  const label = month ? `Bulan: ${monthLabel(month)}` : "Semua Bulan";
  docHeader(ctx, "Laporan Rekap Purchase Order", label);

  ensure(ctx, 20);
  text(ctx, `Total PO: ${pos.length}`, { size: 9, color: C.sub });
  ctx.y -= 16;

  const header = ["No PO", "Klien", "Item", "Bahan", "Qty", "Est. Produksi", "Mesin", "Status"];
  const weights = [0.95, 1.5, 1.3, 1.2, 0.6, 1.7, 1.05, 1.5];

  if (!pos.length) {
    drawTable(ctx, header, [], { weights });
    return await finish(ctx);
  }

  // Kelompokkan per bulan (terbaru lebih dulu), seperti tampilan Daftar PO.
  const groups = new Map();
  for (const p of pos) {
    const mk = poMonth(p);
    if (!groups.has(mk)) groups.set(mk, []);
    groups.get(mk).push(p);
  }
  const monthKeys = [...groups.keys()].sort().reverse();

  for (const mk of monthKeys) {
    const rows = groups.get(mk).slice()
      .sort((a, b) => (a.po_date || a.est_start || "").localeCompare(b.po_date || b.est_start || ""));
    section(ctx, `${monthLabel(mk)} (${rows.length} PO)`);
    const data = rows.map((p) => {
      const c = p.computed || computeStatus(p);
      return [
        p.po_number || "-",
        p.client_name || "-",
        p.item_type || "-",
        p.material || "-",
        String(p.quantity || "-"),
        `${fmtDate(p.est_start)} s/d ${fmtDate(p.est_end)}`,
        p.print_machine || "-",
        BUCKET_LABELS[c.bucket] || c.bucket || "-",
      ];
    });
    drawTable(ctx, header, data, { weights });
  }

  return await finish(ctx);
}
