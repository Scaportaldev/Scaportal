/** PDF Jatuh Tempo Klien — pdf-lib via core.js (konsisten dengan modul lain). */
import {
  createDoc, docHeader, section, drawTable, text, barChart, C, finish, ensure,
} from "@/server/pdf/core";

const rp = (v) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(v) || 0);

const fmtDate = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
};

const STATUS_LABEL = (s) => (s === "lunas" ? "Lunas" : "Belum Lunas");

/** Rekap seluruh invoice (dipakai juga sebagai backup wajib sebelum hapus semua). */
export async function buildInvoicesPdf({ invoices, periodLabel }) {
  const ctx = await createDoc({ landscape: true });
  docHeader(ctx, "LAPORAN JATUH TEMPO KLIEN", periodLabel || "Seluruh data invoice");

  const list = invoices || [];
  const totalNilai = list.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalBayar = list.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);
  const totalSisa = list.reduce((s, i) => s + (Number(i.remaining_amount) || 0), 0);

  text(ctx, `Jumlah invoice: ${list.length}   |   Nilai: ${rp(totalNilai)}   |   Terbayar: ${rp(totalBayar)}   |   Sisa: ${rp(totalSisa)}`, {
    size: 9, color: C.sub,
  });
  ctx.y -= 16;

  section(ctx, "Daftar Invoice");
  const rows = list.map((i, idx) => [
    String(idx + 1),
    i.client_name || "-",
    i.invoice_number || "-",
    i.top || "-",
    fmtDate(i.invoice_date),
    fmtDate(i.due_date),
    rp(i.total_amount),
    rp(i.paid_amount),
    rp(i.remaining_amount),
    STATUS_LABEL(i.status),
  ]);

  if (rows.length === 0) {
    text(ctx, "Belum ada invoice.", { size: 9, color: C.sub });
    ctx.y -= 14;
  } else {
    drawTable(
      ctx,
      ["No", "Nama Klien", "No. Invoice", "TOP", "Tgl Invoice", "Jatuh Tempo", "Total", "Terbayar", "Sisa", "Status"],
      rows,
      { weights: [0.5, 2.3, 1.4, 1, 1.2, 1.2, 1.5, 1.5, 1.5, 1.3], rightCols: [6, 7, 8], fontSize: 7.5 },
    );
    ensure(ctx, 30);
    ctx.y -= 4;
    text(ctx, `TOTAL — Nilai ${rp(totalNilai)} · Terbayar ${rp(totalBayar)} · Sisa ${rp(totalSisa)}`, {
      size: 9, bold: true, color: C.header,
    });
    ctx.y -= 14;
  }

  return finish(ctx);
}

/** Detail 1 invoice + riwayat cicilan. */
export async function buildInvoiceDetailPdf({ invoice }) {
  const ctx = await createDoc();
  const inv = invoice || {};
  docHeader(ctx, "DETAIL INVOICE KLIEN", inv.invoice_number ? `No. ${inv.invoice_number}` : (inv.client_name || "-"));

  section(ctx, "Informasi Invoice");
  drawTable(
    ctx,
    ["Keterangan", "Nilai"],
    [
      ["Nama Klien", inv.client_name || "-"],
      ["TOP / Sistem Pembayaran", inv.top || "-"],
      ["Tanggal PO", fmtDate(inv.po_date)],
      ["No. PO", inv.po_number || "-"],
      ["No. Surat Jalan", inv.delivery_note_number || "-"],
      ["No. Invoice", inv.invoice_number || "-"],
      ["Tanggal Invoice", fmtDate(inv.invoice_date)],
      ["Tanggal Jatuh Tempo", fmtDate(inv.due_date)],
      ["Nominal Total", rp(inv.total_amount)],
      ["Terbayar", rp(inv.paid_amount)],
      ["Sisa Tagihan", rp(inv.remaining_amount)],
      ["Status", STATUS_LABEL(inv.status)],
    ],
    { weights: [1.4, 1.6], rightCols: [1], fontSize: 9 },
  );

  const installments = [...(inv.installments || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  if (inv.top === "Cicilan") {
    section(ctx, "Riwayat Cicilan");
    if (installments.length === 0) {
      text(ctx, "Belum ada pembayaran cicilan.", { size: 9, color: C.sub });
      ctx.y -= 14;
    } else {
      drawTable(
        ctx,
        ["Cicilan ke-", "Tanggal", "Nominal"],
        installments.map((c) => [String(c.sequence), fmtDate(c.date), rp(c.amount)]),
        { weights: [1, 1.2, 1.4], rightCols: [2], fontSize: 9 },
      );
    }
  }

  return finish(ctx);
}

/** Laporan keuangan: ringkasan + omset bulanan + rincian per klien. */
export async function buildTempoReportPdf({ summary, breakdown, monthly, year, periodLabel }) {
  const ctx = await createDoc();
  docHeader(ctx, "LAPORAN KEUANGAN JATUH TEMPO KLIEN", periodLabel || `Tahun ${year}`);

  const s = summary || {};
  section(ctx, "Ringkasan");
  drawTable(
    ctx,
    ["Keterangan", "Nilai"],
    [
      ["Pemasukan Bulan Ini", rp(s.pemasukan_bulan_ini)],
      ["Total Piutang", rp(s.total_piutang)],
      ["Invoice Lunas", String(s.count_lunas ?? 0)],
      ["Invoice Belum Lunas", String(s.count_belum_lunas ?? 0)],
      ["Total Nilai Invoice", rp(s.total_nilai_invoice)],
      ["Total Terbayar", rp(s.total_terbayar)],
    ],
    { weights: [1.5, 1.5], rightCols: [1], fontSize: 9 },
  );

  const md = monthly?.data || [];
  if (md.length) {
    section(ctx, `Nilai Invoice per Bulan - ${year}`);
    barChart(ctx, {
      labels: md.map((m) => m.month),
      values: md.map((m) => m.omset),
      title: "Nilai Invoice (Rp)",
      color: C.primary,
    });
    section(ctx, `Pembayaran Diterima per Bulan - ${year}`);
    barChart(ctx, {
      labels: md.map((m) => m.month),
      values: md.map((m) => m.pembayaran),
      title: "Pembayaran Diterima (Rp)",
      color: C.emerald,
    });
  }

  const bdTable = (title, items, emptyText) => {
    section(ctx, title);
    const list = items || [];
    if (list.length === 0) {
      text(ctx, emptyText, { size: 9, color: C.sub });
      ctx.y -= 14;
      return;
    }
    drawTable(ctx, ["Klien", "Nominal"], list.map((i) => [i.client, rp(i.amount)]), {
      weights: [2, 1.2],
      rightCols: [1],
      fontSize: 9,
    });
  };

  bdTable("Pemasukan Bulan Ini - per Klien", breakdown?.pemasukan_by_client, "Belum ada pembayaran masuk bulan ini.");
  bdTable("Lunas Bulan Ini - per Klien", breakdown?.lunas_by_client, "Belum ada invoice yang lunas bulan ini.");
  bdTable("Total Piutang - per Klien", breakdown?.piutang_by_client, "Tidak ada piutang berjalan.");

  return finish(ctx);
}
