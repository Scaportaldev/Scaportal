import { getDb, COL, stripId, currentYear } from "@/server/mongo";
import {
  computePaperStocks, computeInkStocks, computeOtherStocks, signedQty, paperKey, round,
} from "@/server/stock";
import { ID_MONTHS } from "@/server/format";

export async function allYear(collection, year) {
  const db = await getDb();
  const docs = await db.collection(collection).find({ year }).toArray();
  return docs.map(stripId);
}

const sum = (arr) => arr.reduce((a, b) => a + Number(b || 0), 0);
const pad = (n) => String(n).padStart(2, "0");

function subsetUpTo(muts, end) {
  return end ? muts.filter((m) => m.date <= end) : muts;
}

function inRange(m, start, end) {
  return (!start || m.date >= start) && (!end || m.date <= end);
}

function countRange(muts, start, end, transaksi) {
  return muts.filter((m) => inRange(m, start, end) && m.jenis_transaksi === transaksi).length;
}

// ---------------- DASHBOARD ----------------
export async function computeDashboard(current) {
  const year = currentYear();
  const [paper, ink, other] = await Promise.all([
    allYear(COL.paper, year), allYear(COL.ink, year), allYear(COL.other, year),
  ]);

  const p = computePaperStocks(paper);
  const i = computeInkStocks(ink);
  const o = computeOtherStocks(other);

  const totalPaper = round(sum(Object.values(p).map((v) => Math.max(v.stock, 0))), 2);
  const totalInk = round(sum(Object.values(i).map((v) => Math.max(v.stock, 0))), 2);
  const nominalPaper = round(sum(Object.values(p).map((v) => v.nominal)), 2);
  const nominalInk = round(sum(Object.values(i).map((v) => v.nominal)), 2);
  const nominalOther = round(sum(Object.values(o).map((v) => v.nominal)), 2);

  const today = new Date().toISOString().slice(0, 10);
  const mutationsToday = [...paper, ...ink, ...other].filter((m) => m.date === today).length;

  const now = new Date();
  const months = [];
  for (let k = 5; k >= 0; k--) {
    let mm = now.getMonth() + 1 - k;
    let yy = now.getFullYear();
    while (mm <= 0) { mm += 12; yy -= 1; }
    months.push([yy, mm]);
  }
  const trend = months.map(([yy, mm]) => {
    const prefix = `${yy}-${pad(mm)}`;
    const f = (arr, t) => sum(arr.filter((m) => m.date.startsWith(prefix) && m.jenis_transaksi === t).map((m) => m.jumlah));
    return {
      label: ID_MONTHS[mm - 1].slice(0, 3),
      paper_masuk: round(f(paper, "masuk"), 2),
      paper_keluar: round(f(paper, "keluar"), 2),
      ink_masuk: round(f(ink, "masuk"), 2),
      ink_keluar: round(f(ink, "keluar"), 2),
    };
  });

  const combined = [
    ...paper.map((m) => ({ ...m, kategori: "Kertas", satuan: "Rim", nama: m.jenis_kertas })),
    ...ink.map((m) => ({ ...m, kategori: "Tinta", satuan: "Kg", nama: m.jenis_tinta })),
    ...other.map((m) => ({ ...m, kategori: "Lain", satuan: m.satuan || "unit", nama: m.nama_barang })),
  ];
  combined.sort((a, b) => `${b.date}${b.created_at || ""}`.localeCompare(`${a.date}${a.created_at || ""}`));

  const result = {
    total_paper_stock: totalPaper,
    total_ink_stock: totalInk,
    mutations_today: mutationsToday,
    trend,
    recent: combined.slice(0, 10),
    year,
  };
  if (current?.role === "superadmin") {
    result.nominal_paper = nominalPaper;
    result.nominal_ink = nominalInk;
    result.nominal_other = nominalOther;
    result.nominal_total = round(nominalPaper + nominalInk + nominalOther, 2);
  }
  return result;
}

// ---------------- STOK RINGKAS ----------------
export async function computeStock() {
  const year = currentYear();
  const [paper, ink, other] = await Promise.all([
    allYear(COL.paper, year), allYear(COL.ink, year), allYear(COL.other, year),
  ]);
  const p = computePaperStocks(paper);
  const i = computeInkStocks(ink);
  const o = computeOtherStocks(other);

  const bySupplier = (rows, keyFn) => {
    const acc = {};
    for (const m of rows) {
      const k = keyFn(m);
      const s = (m.supplier || "").trim() || "Tanpa Supplier";
      acc[k] = acc[k] || {};
      acc[k][s] = (acc[k][s] || 0) + signedQty(m);
    }
    return acc;
  };
  const supList = (map, k) =>
    Object.entries(map[k] || {})
      .map(([supplier, q]) => ({ supplier, stock: round(q, 3) }))
      .filter((x) => x.stock !== 0)
      .sort((a, b) => b.stock - a.stock);

  const psup = bySupplier(paper, paperKey);
  const paperList = Object.entries(p).map(([k, v]) => ({
    jenis_kertas: v.jenis_kertas, gramatur: v.gramatur, panjang: v.panjang, lebar: v.lebar,
    stock: v.stock, suppliers: supList(psup, k),
  }));

  const isup = bySupplier(ink, (m) => m.jenis_tinta ?? "");
  const inkList = Object.entries(i).map(([k, v]) => ({
    jenis_tinta: v.jenis_tinta, stock: v.stock, suppliers: supList(isup, k),
  }));

  const osup = bySupplier(other, (m) => m.nama_barang ?? "");
  const otherList = Object.entries(o).map(([k, v]) => ({
    nama_barang: v.nama_barang, satuan: v.satuan, stock: v.stock, suppliers: supList(osup, k),
  }));

  paperList.sort((a, b) => a.jenis_kertas.localeCompare(b.jenis_kertas) || a.gramatur - b.gramatur);
  inkList.sort((a, b) => a.jenis_tinta.localeCompare(b.jenis_tinta));
  otherList.sort((a, b) => a.nama_barang.localeCompare(b.nama_barang));

  return { paper: paperList, ink: inkList, other: otherList, year };
}

// ---------------- LAPORAN DETAIL ----------------
export async function computeDetail(startIn, endIn) {
  const year = currentYear();
  const start = startIn || `${year}-01-01`;
  const end = endIn || new Date().toISOString().slice(0, 10);

  const [paper, ink, other] = await Promise.all([
    allYear(COL.paper, year), allYear(COL.ink, year), allYear(COL.other, year),
  ]);

  const pStocks = computePaperStocks(subsetUpTo(paper, end));
  const iStocks = computeInkStocks(subsetUpTo(ink, end));
  const oStocks = computeOtherStocks(subsetUpTo(other, end));

  const nominalPaper = round(sum(Object.values(pStocks).map((v) => v.nominal)), 2);
  const nominalInk = round(sum(Object.values(iStocks).map((v) => v.nominal)), 2);
  const nominalOther = round(sum(Object.values(oStocks).map((v) => v.nominal)), 2);

  // Nama komposisi dibuat UNIK: satu jenis kertas bisa punya beberapa gramatur/
  // ukuran, kalau namanya sama grafik jadi ambigu (dan React duplicate key).
  const paperComposition = Object.values(pStocks).filter((v) => v.nominal > 0)
    .map((v) => ({
      name: [v.jenis_kertas, v.gramatur ? `${v.gramatur}gr` : null].filter(Boolean).join(" "),
      value: v.nominal,
    }));
  const inkComposition = Object.values(iStocks).filter((v) => v.nominal > 0)
    .map((v) => ({ name: v.jenis_tinta, value: v.nominal }));
  const otherComposition = Object.values(oStocks).filter((v) => v.nominal > 0)
    .map((v) => ({ name: v.nama_barang, value: v.nominal }));

  const now = new Date();
  const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const monthlyTrend = [];
  const monthlyValue = [];
  for (let mm = 1; mm <= lastMonth; mm++) {
    const prefix = `${year}-${pad(mm)}`;
    const monthEnd = `${year}-${pad(mm)}-31`;
    const f = (arr, t) => sum(arr.filter((m) => m.date.startsWith(prefix) && m.jenis_transaksi === t).map((m) => m.jumlah));
    monthlyTrend.push({
      label: ID_MONTHS[mm - 1].slice(0, 3),
      paper_masuk: round(f(paper, "masuk"), 2),
      paper_keluar: round(f(paper, "keluar"), 2),
      ink_masuk: round(f(ink, "masuk"), 2),
      ink_keluar: round(f(ink, "keluar"), 2),
    });
    const pv = sum(Object.values(computePaperStocks(subsetUpTo(paper, monthEnd))).map((v) => v.nominal));
    const iv = sum(Object.values(computeInkStocks(subsetUpTo(ink, monthEnd))).map((v) => v.nominal));
    const ov = sum(Object.values(computeOtherStocks(subsetUpTo(other, monthEnd))).map((v) => v.nominal));
    monthlyValue.push({
      label: ID_MONTHS[mm - 1].slice(0, 3),
      paper: round(pv, 2), ink: round(iv, 2), other: round(ov, 2), total: round(pv + iv + ov, 2),
    });
  }

  const ppnMonthly = [];
  for (let mm = 1; mm <= 12; mm++) {
    const prefix = `${year}-${pad(mm)}`;
    const f = (arr) => sum(arr.filter((m) => m.date.startsWith(prefix) && m.ppn_ada).map((m) => m.ppn_nominal));
    const pp = f(paper), ip = f(ink), op = f(other);
    ppnMonthly.push({
      label: ID_MONTHS[mm - 1],
      paper: round(pp, 2), ink: round(ip, 2), other: round(op, 2), total: round(pp + ip + op, 2),
    });
  }

  // periode sebelumnya dengan panjang sama
  const DAY = 86400000;
  const sd = new Date(`${start}T00:00:00Z`);
  const ed = new Date(`${end}T00:00:00Z`);
  const length = Math.round((ed - sd) / DAY);
  const prevEnd = new Date(sd.getTime() - DAY);
  const prevStart = new Date(prevEnd.getTime() - length * DAY);
  const prevEndS = prevEnd.toISOString().slice(0, 10);
  const prevStartS = prevStart.toISOString().slice(0, 10);

  const prevP = computePaperStocks(subsetUpTo(paper, prevEndS));
  const prevI = computeInkStocks(subsetUpTo(ink, prevEndS));
  const prevO = computeOtherStocks(subsetUpTo(other, prevEndS));
  const prevNominalPaper = round(sum(Object.values(prevP).map((v) => v.nominal)), 2);
  const prevNominalInk = round(sum(Object.values(prevI).map((v) => v.nominal)), 2);
  const prevNominalOther = round(sum(Object.values(prevO).map((v) => v.nominal)), 2);

  const pct = (cur, prev) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return round(((cur - prev) / prev) * 100, 1);
  };

  const comparison = {
    prev_start: prevStartS,
    prev_end: prevEndS,
    paper_nominal: {
      current: nominalPaper, prev: prevNominalPaper,
      diff: round(nominalPaper - prevNominalPaper, 2), pct: pct(nominalPaper, prevNominalPaper),
    },
    ink_nominal: {
      current: nominalInk, prev: prevNominalInk,
      diff: round(nominalInk - prevNominalInk, 2), pct: pct(nominalInk, prevNominalInk),
    },
    other_nominal: {
      current: nominalOther, prev: prevNominalOther,
      diff: round(nominalOther - prevNominalOther, 2), pct: pct(nominalOther, prevNominalOther),
    },
    paper_masuk: { current: countRange(paper, start, end, "masuk"), prev: countRange(paper, prevStartS, prevEndS, "masuk") },
    paper_keluar: { current: countRange(paper, start, end, "keluar"), prev: countRange(paper, prevStartS, prevEndS, "keluar") },
    ink_masuk: { current: countRange(ink, start, end, "masuk"), prev: countRange(ink, prevStartS, prevEndS, "masuk") },
    ink_keluar: { current: countRange(ink, start, end, "keluar"), prev: countRange(ink, prevStartS, prevEndS, "keluar") },
  };

  return {
    start, end, year,
    nominal_paper: nominalPaper, nominal_ink: nominalInk, nominal_other: nominalOther,
    nominal_total: round(nominalPaper + nominalInk + nominalOther, 2),
    paper_composition: paperComposition,
    ink_composition: inkComposition,
    other_composition: otherComposition,
    monthly_trend: monthlyTrend,
    monthly_value: monthlyValue,
    ppn_monthly: ppnMonthly,
    ppn_total_year: round(sum(ppnMonthly.map((x) => x.total)), 2),
    comparison,
  };
}
