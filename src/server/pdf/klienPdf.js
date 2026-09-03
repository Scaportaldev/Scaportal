/** PDF Stok Klien — memakai infrastruktur pdf-lib yang sudah ada (core.js). */
import { createDoc, docHeader, section, drawTable, text, C, finish, ensure } from "@/server/pdf/core";

const fmtQty = (v) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(v) || 0);

const fmtDate = (v) => {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

const fmtDateTime = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 16);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}.${p(d.getMinutes())}`;
};

function summaryLine(ctx, summary) {
  ensure(ctx, 30);
  const s = summary || {};
  text(
    ctx,
    `Total Klien: ${s.total_klien ?? 0}   |   PO Aktif: ${s.total_po_aktif ?? 0}   |   Item Aktif: ${s.total_item_aktif ?? 0}   |   Item Selesai/Ditutup: ${s.total_item_selesai ?? 0}`,
    { size: 9, color: C.sub },
  );
  ctx.y -= 16;
}

/** Rekap stok seluruh klien (Klien > PO > Item). */
export async function buildKlienStockPdf({ summary, kliens, statusFilter }) {
  const ctx = await createDoc({ landscape: true });
  const label =
    statusFilter && statusFilter !== "semua"
      ? `Status item: ${statusFilter === "aktif" ? "Aktif" : "Selesai/Ditutup"}`
      : "Semua status item";
  docHeader(ctx, "LAPORAN STOK KLIEN SCA", label);
  summaryLine(ctx, summary);

  const rows = [];
  (kliens || []).forEach((k) => {
    (k.pos || []).forEach((p) => {
      (p.items || []).forEach((it) => {
        rows.push([
          k.nama || "-",
          p.no_po || "-",
          fmtDate(p.tanggal_po),
          it.jenis_item || "-",
          it.satuan || "-",
          fmtQty(it.kuantiti),
          it.status === "aktif" ? "Aktif" : "Selesai/Ditutup",
          it.keterangan || "-",
        ]);
      });
    });
  });

  section(ctx, "Rincian Stok per Klien & PO");
  if (rows.length === 0) {
    text(ctx, "Belum ada data stok klien.", { size: 9, color: C.sub });
    ctx.y -= 14;
  } else {
    drawTable(
      ctx,
      ["Nama Klien", "No PO", "Tanggal PO", "Jenis Item", "Satuan", "Stok", "Status", "Keterangan"],
      rows,
      { weights: [2.2, 1.1, 1.1, 2.2, 0.9, 1, 1.4, 2.4], rightCols: [5], fontSize: 8 },
    );
  }

  return finish(ctx);
}

/** Riwayat mutasi stok klien (sudah terfilter di route). */
export async function buildKlienHistoryPdf({ mutations, periodLabel }) {
  const ctx = await createDoc({ landscape: true });
  docHeader(ctx, "RIWAYAT MUTASI STOK KLIEN", periodLabel || "Semua periode");

  const masuk = (mutations || []).filter((m) => m.jenis === "masuk").length;
  const keluar = (mutations || []).filter((m) => m.jenis === "keluar").length;
  text(ctx, `Total mutasi: ${mutations?.length ?? 0}   |   Masuk: ${masuk}   |   Keluar: ${keluar}`, {
    size: 9,
    color: C.sub,
  });
  ctx.y -= 16;

  section(ctx, "Daftar Mutasi");
  const rows = (mutations || []).map((m) => [
    fmtDateTime(m.tanggal),
    m.nama_klien || "-",
    m.no_po || "-",
    m.jenis_item || "-",
    m.jenis === "masuk" ? "Masuk" : "Keluar",
    `${m.jenis === "masuk" ? "+" : "-"}${fmtQty(m.jumlah)} ${m.satuan || ""}`.trim(),
    m.keterangan || "-",
  ]);

  if (rows.length === 0) {
    text(ctx, "Belum ada mutasi tercatat.", { size: 9, color: C.sub });
    ctx.y -= 14;
  } else {
    drawTable(
      ctx,
      ["Tanggal & Waktu", "Nama Klien", "No PO", "Jenis Item", "Mutasi", "Jumlah", "Keterangan"],
      rows,
      { weights: [1.6, 2, 1, 2, 1, 1.4, 2.6], rightCols: [5], fontSize: 8 },
    );
  }

  return finish(ctx);
}
