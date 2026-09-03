import {
  createDoc, docHeader, section, drawTable, lineChart, barChart, compositionBar, finish, C,
} from "@/server/pdf/core";
import { formatRp, formatNum, formatDateId, TRX_LABEL, MODE_LABEL } from "@/server/format";

const dash = (v) => (v === null || v === undefined || v === "" ? "-" : v);

export async function paperMutationsPdf(rows, periodLabel) {
  const ctx = await createDoc({ landscape: true });
  docHeader(ctx, "Laporan Mutasi Stok Kertas", periodLabel);
  const header = ["Tanggal", "Kode", "Jenis Kertas", "Gram", "Ukuran", "Transaksi",
    "Jumlah (Rim)", "Supplier", "PIC", "Mode", "Harga", "PPN"];
  const weights = [1.15, 0.85, 1.5, 0.6, 1, 0.9, 1, 1.3, 1.1, 1, 1.15, 1.05];
  // Mode "Total Kiriman" ditampilkan sebagai total harga kiriman, bukan hasil bagi per rim.
  const hargaOf = (m) => (m.price_mode === "total" ? (m.price_input ?? m.harga_per_rim) : m.harga_per_rim);
  const data = rows.map((m) => [
    formatDateId(m.date),
    dash(m.kode),
    m.jenis_kertas || "",
    formatNum(m.gramatur),
    `${formatNum(m.panjang)}x${formatNum(m.lebar)}`,
    TRX_LABEL[m.jenis_transaksi] || "",
    formatNum(m.jumlah),
    dash(m.supplier),
    m.pic_name || "",
    m.jenis_transaksi === "masuk" ? MODE_LABEL[m.price_mode] || "-" : "-",
    m.jenis_transaksi === "masuk" ? formatRp(hargaOf(m)) : "-",
    m.ppn_ada ? formatRp(m.ppn_nominal) : "-",
  ]);
  drawTable(ctx, header, data, { weights, rightCols: [6, 10, 11] });
  return await finish(ctx);
}

export async function inkMutationsPdf(rows, periodLabel) {
  const ctx = await createDoc({ landscape: true });
  docHeader(ctx, "Laporan Mutasi Stok Tinta", periodLabel);
  const header = ["Tanggal", "Kode", "Jenis Tinta", "Transaksi", "Jumlah (Kg)",
    "Supplier", "PIC", "Harga/Kg", "PPN"];
  const weights = [1.2, 1, 1.6, 1, 1.1, 1.5, 1.3, 1.2, 1.1];
  const data = rows.map((m) => [
    formatDateId(m.date),
    dash(m.kode),
    m.jenis_tinta || "",
    TRX_LABEL[m.jenis_transaksi] || "",
    formatNum(m.jumlah),
    dash(m.supplier),
    m.pic_name || "",
    m.jenis_transaksi === "masuk" ? formatRp(m.harga_per_kg) : "-",
    m.ppn_ada ? formatRp(m.ppn_nominal) : "-",
  ]);
  drawTable(ctx, header, data, { weights, rightCols: [4, 7, 8] });
  return await finish(ctx);
}

export async function otherMutationsPdf(rows, periodLabel) {
  const ctx = await createDoc({ landscape: true });
  docHeader(ctx, "Laporan Mutasi Stok Lain", periodLabel);
  const header = ["Tanggal", "Kode", "Nama Barang", "Satuan", "Transaksi", "Jumlah",
    "Supplier", "PIC", "Harga/Satuan", "PPN"];
  const weights = [1.2, 1, 1.6, 0.8, 1, 1, 1.4, 1.2, 1.2, 1.1];
  const data = rows.map((m) => [
    formatDateId(m.date),
    dash(m.kode),
    m.nama_barang || "",
    dash(m.satuan),
    TRX_LABEL[m.jenis_transaksi] || "",
    formatNum(m.jumlah),
    dash(m.supplier),
    m.pic_name || "",
    m.jenis_transaksi === "masuk" ? formatRp(m.harga_per_satuan) : "-",
    m.ppn_ada ? formatRp(m.ppn_nominal) : "-",
  ]);
  drawTable(ctx, header, data, { weights, rightCols: [5, 8, 9] });
  return await finish(ctx);
}

const supStr = (item) =>
  (item.suppliers || []).map((s) => `${s.supplier}: ${formatNum(s.stock)}`).join(", ") || "-";

export async function stockSummaryPdf(stock, periodLabel, detail = null) {
  const ctx = await createDoc();
  docHeader(ctx, detail ? "Laporan Stok Keseluruhan" : "Laporan Stok Ringkas", periodLabel);

  section(ctx, "Rekap Stok Kertas");
  drawTable(
    ctx,
    ["Jenis Kertas", "Gramatur", "Ukuran (cm)", "Per Supplier", "Stok (Rim)"],
    (stock.paper || []).map((p) => [
      p.jenis_kertas, formatNum(p.gramatur),
      `${formatNum(p.panjang)}x${formatNum(p.lebar)}`, supStr(p), formatNum(p.stock),
    ]),
    { weights: [1.6, 0.9, 1.1, 2.4, 1], rightCols: [4] },
  );

  section(ctx, "Rekap Stok Tinta");
  drawTable(
    ctx,
    ["Jenis Tinta", "Per Supplier", "Stok (Kg)"],
    (stock.ink || []).map((i) => [i.jenis_tinta, supStr(i), formatNum(i.stock)]),
    { weights: [1.6, 2.6, 1], rightCols: [2] },
  );

  section(ctx, "Rekap Stok Lain");
  drawTable(
    ctx,
    ["Nama Barang", "Satuan", "Per Supplier", "Stok"],
    (stock.other || []).map((o) => [o.nama_barang, o.satuan || "-", supStr(o), formatNum(o.stock)]),
    { weights: [1.7, 0.8, 2.4, 1], rightCols: [3] },
  );

  if (detail) {
    section(ctx, "Nilai Nominal Stok (Rupiah)");
    drawTable(
      ctx,
      ["Kategori", "Nominal"],
      [
        ["Stok Kertas", formatRp(detail.nominal_paper)],
        ["Stok Tinta", formatRp(detail.nominal_ink)],
        ["Stok Lain", formatRp(detail.nominal_other || 0)],
        ["TOTAL", formatRp(detail.nominal_total)],
      ],
      { weights: [2, 1], rightCols: [1] },
    );

    if ((detail.paper_composition || []).length) {
      compositionBar(ctx, {
        title: "Komposisi Nominal Kertas",
        items: detail.paper_composition,
        formatValue: formatRp,
      });
    }

    const mv = detail.monthly_value || [];
    if (mv.length) {
      lineChart(ctx, {
        title: "Tren Nilai Stok per Bulan (Rp)",
        labels: mv.map((m) => m.label),
        series: [{ name: "Total Nilai Stok", values: mv.map((m) => m.total), color: C.primary }],
      });
    }

    section(ctx, "Total PPN Dibayarkan per Bulan");
    const ppn = detail.ppn_monthly || [];
    drawTable(
      ctx,
      ["Bulan", "PPN Kertas", "PPN Tinta", "PPN Lain", "Total"],
      [
        ...ppn.map((p) => [p.label, formatRp(p.paper), formatRp(p.ink), formatRp(p.other || 0), formatRp(p.total)]),
        ["TOTAL TAHUN", "", "", "", formatRp(detail.ppn_total_year || 0)],
      ],
      { weights: [1.3, 1, 1, 1, 1.1], rightCols: [1, 2, 3, 4] },
    );
  }

  return await finish(ctx);
}

export async function detailReportPdf(detail, periodLabel) {
  const ctx = await createDoc();
  docHeader(ctx, "Laporan Detail (Nominal & Grafik)", periodLabel);

  drawTable(
    ctx,
    ["Kategori", "Nominal Stok"],
    [
      ["Stok Kertas", formatRp(detail.nominal_paper)],
      ["Stok Tinta", formatRp(detail.nominal_ink)],
      ["Stok Lain", formatRp(detail.nominal_other || 0)],
      ["TOTAL", formatRp(detail.nominal_total)],
    ],
    { weights: [2, 1], rightCols: [1] },
  );

  const cmp = detail.comparison || {};
  section(ctx, "Perbandingan dengan Periode Sebelumnya");
  const cell = (o, k) => (o && o[k] !== undefined ? o[k] : 0);
  drawTable(
    ctx,
    ["Metrik", "Periode Ini", "Periode Lalu", "Selisih", "%"],
    [
      ["Nominal Kertas", formatRp(cell(cmp.paper_nominal, "current")), formatRp(cell(cmp.paper_nominal, "prev")),
        formatRp(cell(cmp.paper_nominal, "diff")), `${cell(cmp.paper_nominal, "pct")}%`],
      ["Nominal Tinta", formatRp(cell(cmp.ink_nominal, "current")), formatRp(cell(cmp.ink_nominal, "prev")),
        formatRp(cell(cmp.ink_nominal, "diff")), `${cell(cmp.ink_nominal, "pct")}%`],
      ["Nominal Lain", formatRp(cell(cmp.other_nominal, "current")), formatRp(cell(cmp.other_nominal, "prev")),
        formatRp(cell(cmp.other_nominal, "diff")), `${cell(cmp.other_nominal, "pct")}%`],
      ["Mutasi Masuk Kertas", cell(cmp.paper_masuk, "current"), cell(cmp.paper_masuk, "prev"), "", ""],
      ["Mutasi Keluar Kertas", cell(cmp.paper_keluar, "current"), cell(cmp.paper_keluar, "prev"), "", ""],
      ["Mutasi Masuk Tinta", cell(cmp.ink_masuk, "current"), cell(cmp.ink_masuk, "prev"), "", ""],
      ["Mutasi Keluar Tinta", cell(cmp.ink_keluar, "current"), cell(cmp.ink_keluar, "prev"), "", ""],
    ],
    { weights: [1.9, 1.2, 1.2, 1.2, 0.7], rightCols: [1, 2, 3, 4] },
  );

  const mt = detail.monthly_trend || [];
  if (mt.length) {
    lineChart(ctx, {
      title: "Tren Mutasi Kertas & Tinta",
      labels: mt.map((m) => m.label),
      series: [
        { name: "Kertas Masuk (Rim)", values: mt.map((m) => m.paper_masuk), color: C.primary },
        { name: "Kertas Keluar (Rim)", values: mt.map((m) => m.paper_keluar), color: C.rose },
        { name: "Tinta Masuk (Kg)", values: mt.map((m) => m.ink_masuk), color: C.sky },
        { name: "Tinta Keluar (Kg)", values: mt.map((m) => m.ink_keluar), color: C.amber },
      ],
    });
  }

  const mv = detail.monthly_value || [];
  if (mv.length) {
    barChart(ctx, {
      title: "Nilai Total Stok per Bulan (Rp)",
      labels: mv.map((m) => m.label),
      values: mv.map((m) => m.total),
      color: C.sky,
    });
  }

  if ((detail.paper_composition || []).length) {
    compositionBar(ctx, {
      title: "Komposisi Nominal Kertas",
      items: detail.paper_composition,
      formatValue: formatRp,
    });
  }
  if ((detail.ink_composition || []).length) {
    compositionBar(ctx, {
      title: "Komposisi Nominal Tinta",
      items: detail.ink_composition,
      formatValue: formatRp,
    });
  }

  section(ctx, "Total PPN Dibayarkan per Bulan");
  const ppn = detail.ppn_monthly || [];
  drawTable(
    ctx,
    ["Bulan", "PPN Kertas", "PPN Tinta", "PPN Lain", "Total"],
    [
      ...ppn.map((p) => [p.label, formatRp(p.paper), formatRp(p.ink), formatRp(p.other || 0), formatRp(p.total)]),
      ["TOTAL TAHUN", "", "", "", formatRp(detail.ppn_total_year || 0)],
    ],
    { weights: [1.3, 1, 1, 1, 1.1], rightCols: [1, 2, 3, 4] },
  );

  if (ppn.length) {
    barChart(ctx, {
      title: "Tren PPN Dibayarkan per Bulan (Rp)",
      labels: ppn.map((p) => p.label.slice(0, 3)),
      values: ppn.map((p) => p.total),
      color: C.amber,
    });
  }

  return await finish(ctx);
}
