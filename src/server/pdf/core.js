import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];

export const C = {
  header: rgb(0.118, 0.161, 0.231), // #1e293b
  primary: rgb(0.145, 0.388, 0.922), // #2563eb
  light: rgb(0.945, 0.961, 0.976), // #f1f5f9
  border: rgb(0.796, 0.835, 0.882), // #cbd5e1
  white: rgb(1, 1, 1),
  sub: rgb(0.392, 0.455, 0.545), // #64748b
  text: rgb(0.09, 0.11, 0.14),
  rose: rgb(0.956, 0.247, 0.369),
  sky: rgb(0.055, 0.647, 0.914),
  amber: rgb(0.961, 0.62, 0.043),
  emerald: rgb(0.02, 0.588, 0.412),
  violet: rgb(0.545, 0.361, 0.965),
};

export const SERIES_COLORS = [C.primary, C.rose, C.sky, C.amber, C.emerald, C.violet];

/** pdf-lib StandardFonts hanya mendukung WinAnsi — bersihkan karakter di luar itu. */
export function sanitize(input) {
  let s = String(input ?? "");
  s = s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
  // buang sisa karakter non-latin1
  return s.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

export async function createDoc({ landscape = false } = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("LAPORAN STOK SCA");
  pdf.setProducer("LAPORAN STOK SCA");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = landscape ? [A4[1], A4[0]] : [A4[0], A4[1]];
  const ctx = { pdf, font, bold, size, margin: 34, page: null, y: 0, landscape };
  newPage(ctx);
  return ctx;
}

export function newPage(ctx) {
  ctx.page = ctx.pdf.addPage(ctx.size);
  ctx.y = ctx.size[1] - ctx.margin;
}

export function contentWidth(ctx) {
  return ctx.size[0] - ctx.margin * 2;
}

export function ensure(ctx, h) {
  if (ctx.y - h < ctx.margin) {
    newPage(ctx);
    return true;
  }
  return false;
}

export function text(ctx, str, { x, y, size = 9, bold = false, color = C.text } = {}) {
  const f = bold ? ctx.bold : ctx.font;
  ctx.page.drawText(sanitize(str), {
    x: x ?? ctx.margin,
    y: y ?? ctx.y,
    size,
    font: f,
    color,
  });
}

export function widthOf(ctx, str, size = 9, bold = false) {
  const f = bold ? ctx.bold : ctx.font;
  return f.widthOfTextAtSize(sanitize(str), size);
}

export function truncate(ctx, str, maxWidth, size = 8, bold = false) {
  let s = sanitize(str);
  if (widthOf(ctx, s, size, bold) <= maxWidth) return s;
  while (s.length > 1 && widthOf(ctx, s + "..", size, bold) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "..";
}

export function docHeader(ctx, title, periodLabel) {
  const printed = new Date();
  text(ctx, title, { size: 16, bold: true, color: C.header });
  ctx.y -= 14;
  text(ctx, `Periode: ${periodLabel}`, { size: 8.5, color: C.sub });
  ctx.y -= 11;
  const d = printed;
  const ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  text(ctx, `Tanggal cetak: ${d.getDate()} ${ID[d.getMonth()]} ${d.getFullYear()}`, { size: 8.5, color: C.sub });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: ctx.margin, y: ctx.y },
    end: { x: ctx.size[0] - ctx.margin, y: ctx.y },
    thickness: 1,
    color: C.primary,
  });
  ctx.y -= 16;
}

export function section(ctx, title) {
  ensure(ctx, 40);
  ctx.y -= 6;
  text(ctx, title, { size: 11.5, bold: true, color: C.primary });
  ctx.y -= 14;
}

/**
 * Tabel dengan header berulang tiap halaman.
 * weights: array bobot lebar kolom (relatif). rightCols: index kolom rata kanan.
 */
export function drawTable(ctx, header, rows, { weights, rightCols = [], fontSize = 8 } = {}) {
  const total = contentWidth(ctx);
  const w = weights && weights.length === header.length ? weights : header.map(() => 1);
  const sumW = w.reduce((a, b) => a + b, 0);
  const widths = w.map((x) => (x / sumW) * total);
  const rowH = fontSize + 9;
  const pad = 4;

  const drawRow = (cells, { isHeader = false, zebra = false } = {}) => {
    const yTop = ctx.y;
    const yBot = yTop - rowH;
    if (isHeader) {
      ctx.page.drawRectangle({
        x: ctx.margin, y: yBot, width: total, height: rowH, color: C.header,
      });
    } else if (zebra) {
      ctx.page.drawRectangle({
        x: ctx.margin, y: yBot, width: total, height: rowH, color: C.light,
      });
    }
    let x = ctx.margin;
    cells.forEach((cell, i) => {
      const cw = widths[i];
      ctx.page.drawRectangle({
        x, y: yBot, width: cw, height: rowH,
        borderColor: C.border, borderWidth: 0.5,
      });
      const raw = cell === null || cell === undefined || cell === "" ? "" : String(cell);
      const label = truncate(ctx, raw, cw - pad * 2, fontSize, isHeader);
      const tw = widthOf(ctx, label, fontSize, isHeader);
      const tx = rightCols.includes(i) && !isHeader ? x + cw - pad - tw : x + pad;
      ctx.page.drawText(label, {
        x: tx,
        y: yBot + (rowH - fontSize) / 2 + 1.5,
        size: fontSize,
        font: isHeader ? ctx.bold : ctx.font,
        color: isHeader ? C.white : C.text,
      });
      x += cw;
    });
    ctx.y = yBot;
  };

  ensure(ctx, rowH * 2);
  drawRow(header, { isHeader: true });
  const data = rows.length ? rows : [header.map(() => "-")];
  data.forEach((r, idx) => {
    if (ensure(ctx, rowH)) drawRow(header, { isHeader: true });
    drawRow(r, { zebra: idx % 2 === 1 });
  });
  ctx.y -= 10;
}

function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const step = max / count;
  const mag = 10 ** Math.floor(Math.log10(step));
  const norm = step / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const s = nice * mag;
  const ticks = [];
  for (let v = 0; v <= max + s * 0.001; v += s) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + s);
  return ticks;
}

function compact(v) {
  const n = Number(v || 0);
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "M";
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "jt";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "rb";
  return String(Math.round(n * 100) / 100);
}

function plotFrame(ctx, { title, height }) {
  ensure(ctx, height + 46);
  if (title) {
    text(ctx, title, { size: 9.5, bold: true, color: C.header });
    ctx.y -= 12;
  }
  const axisLabelW = 34;
  const x0 = ctx.margin + axisLabelW;
  const plotW = contentWidth(ctx) - axisLabelW - 6;
  const yTop = ctx.y;
  const yBot = yTop - height;
  return { x0, plotW, yTop, yBot, height };
}

function drawGrid(ctx, frame, ticks) {
  const { x0, plotW, yBot, height } = frame;
  const max = ticks[ticks.length - 1] || 1;
  ticks.forEach((t) => {
    const y = yBot + (t / max) * height;
    ctx.page.drawLine({
      start: { x: x0, y }, end: { x: x0 + plotW, y },
      thickness: 0.4, color: C.border,
    });
    const lbl = compact(t);
    ctx.page.drawText(sanitize(lbl), {
      x: x0 - 4 - ctx.font.widthOfTextAtSize(lbl, 6.5),
      y: y - 2,
      size: 6.5, font: ctx.font, color: C.sub,
    });
  });
}

function drawXLabels(ctx, frame, labels) {
  const { x0, plotW, yBot } = frame;
  const step = plotW / Math.max(labels.length, 1);
  labels.forEach((l, i) => {
    const s = sanitize(String(l).slice(0, 3));
    const w = ctx.font.widthOfTextAtSize(s, 6.5);
    ctx.page.drawText(s, {
      x: x0 + step * i + step / 2 - w / 2,
      y: yBot - 10,
      size: 6.5, font: ctx.font, color: C.sub,
    });
  });
}

function drawLegend(ctx, y, items) {
  let x = ctx.margin + 34;
  items.forEach((it) => {
    ctx.page.drawRectangle({ x, y: y + 1, width: 7, height: 7, color: it.color });
    const label = sanitize(it.name);
    ctx.page.drawText(label, { x: x + 10, y: y + 1.5, size: 6.8, font: ctx.font, color: C.sub });
    x += 10 + ctx.font.widthOfTextAtSize(label, 6.8) + 14;
  });
}

export function lineChart(ctx, { labels, series, title, height = 130 }) {
  const frame = plotFrame(ctx, { title, height });
  const allVals = series.flatMap((s) => s.values.map((v) => Number(v || 0)));
  const max = Math.max(0, ...allVals);
  const ticks = niceTicks(max);
  const tmax = ticks[ticks.length - 1] || 1;
  drawGrid(ctx, frame, ticks);

  const { x0, plotW, yBot } = frame;
  const step = plotW / Math.max(labels.length, 1);
  series.forEach((s, si) => {
    const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
    const pts = s.values.map((v, i) => ({
      x: x0 + step * i + step / 2,
      y: yBot + (Number(v || 0) / tmax) * height,
    }));
    for (let i = 1; i < pts.length; i++) {
      ctx.page.drawLine({ start: pts[i - 1], end: pts[i], thickness: 1.3, color });
    }
    pts.forEach((p) => ctx.page.drawCircle({ x: p.x, y: p.y, size: 1.8, color }));
  });

  // sumbu
  ctx.page.drawLine({ start: { x: x0, y: yBot }, end: { x: x0 + plotW, y: yBot }, thickness: 0.8, color: C.sub });
  drawXLabels(ctx, frame, labels);
  ctx.y = yBot - 22;
  drawLegend(ctx, ctx.y, series.map((s, si) => ({
    name: s.name, color: s.color || SERIES_COLORS[si % SERIES_COLORS.length],
  })));
  ctx.y -= 16;
}

export function barChart(ctx, { labels, values, title, color = C.sky, height = 120 }) {
  const frame = plotFrame(ctx, { title, height });
  const max = Math.max(0, ...values.map((v) => Number(v || 0)));
  const ticks = niceTicks(max);
  const tmax = ticks[ticks.length - 1] || 1;
  drawGrid(ctx, frame, ticks);

  const { x0, plotW, yBot } = frame;
  const step = plotW / Math.max(values.length, 1);
  const bw = Math.max(step * 0.55, 2);
  values.forEach((v, i) => {
    const h = (Number(v || 0) / tmax) * height;
    if (h <= 0) return;
    ctx.page.drawRectangle({
      x: x0 + step * i + (step - bw) / 2, y: yBot, width: bw, height: h, color,
    });
  });
  ctx.page.drawLine({ start: { x: x0, y: yBot }, end: { x: x0 + plotW, y: yBot }, thickness: 0.8, color: C.sub });
  drawXLabels(ctx, frame, labels);
  ctx.y = yBot - 24;
}

/** Komposisi nominal: stacked bar 100% + legenda persentase (pengganti pie chart). */
export function compositionBar(ctx, { title, items, formatValue }) {
  const data = items.filter((i) => Number(i.value) > 0);
  if (!data.length) return;
  const rowsNeeded = 20 + Math.ceil(data.length / 2) * 12 + 30;
  ensure(ctx, rowsNeeded);
  if (title) {
    text(ctx, title, { size: 9.5, bold: true, color: C.header });
    ctx.y -= 14;
  }
  const total = data.reduce((a, b) => a + Number(b.value), 0);
  const w = contentWidth(ctx);
  const h = 16;
  let x = ctx.margin;
  const yBot = ctx.y - h;
  data.forEach((it, i) => {
    const cw = (Number(it.value) / total) * w;
    ctx.page.drawRectangle({
      x, y: yBot, width: cw, height: h,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    });
    x += cw;
  });
  ctx.page.drawRectangle({ x: ctx.margin, y: yBot, width: w, height: h, borderColor: C.border, borderWidth: 0.5 });
  ctx.y = yBot - 14;

  // legenda 2 kolom
  const colW = w / 2;
  data.forEach((it, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) ctx.y -= 12;
    const bx = ctx.margin + col * colW;
    ctx.page.drawRectangle({
      x: bx, y: ctx.y + 1, width: 7, height: 7,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    });
    const pctVal = ((Number(it.value) / total) * 100).toFixed(1);
    const label = `${it.name} - ${formatValue ? formatValue(it.value) : it.value} (${pctVal}%)`;
    ctx.page.drawText(truncate(ctx, label, colW - 16, 7.2), {
      x: bx + 10, y: ctx.y + 1.5, size: 7.2, font: ctx.font, color: C.text,
    });
  });
  ctx.y -= 22;
}

export async function finish(ctx) {
  return await ctx.pdf.save();
}
