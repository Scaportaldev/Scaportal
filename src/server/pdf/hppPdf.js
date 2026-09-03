import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function rp(v) {
  const num = Number(v || 0);
  const neg = num < 0;
  const abs = Math.abs(num);
  const s = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(abs);
  return (neg ? "- " : "") + "Rp " + s;
}

export async function buildHppPdf({ name, customer, notes, company, result }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(30 / 255, 58 / 255, 138 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);
  const grid = rgb(226 / 255, 232 / 255, 240 / 255);

  let page = doc.addPage([595.28, 841.89]); // A4
  const marginX = 40;
  let y = 810;

  page.drawText(company || "Percetakan SCA", { x: marginX, y, font: bold, size: 20, color: navy });
  y -= 18;
  page.drawText("Penawaran Harga Pokok Produksi (HPP)", { x: marginX, y, font, size: 10, color: muted });
  y -= 26;

  const meta = [
    ["Nama Produk", name || "-"],
    ["Customer", customer || "-"],
    ["Tanggal", new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })],
  ];
  meta.forEach(([k, v]) => {
    page.drawText(k, { x: marginX, y, font, size: 10, color: muted });
    page.drawText(":", { x: marginX + 100, y, font, size: 10, color: muted });
    page.drawText(String(v), { x: marginX + 110, y, font, size: 10 });
    y -= 15;
  });
  y -= 10;

  page.drawText("Rincian Komponen Biaya (per Pcs)", { x: marginX, y, font: bold, size: 12, color: navy });
  y -= 8;

  // Table header
  const colX = { no: marginX, label: marginX + 30, value: 480 };
  const drawRow = (no, label, value, isHeader = false, isTotal = false) => {
    const rowH = 18;
    if (isHeader) {
      page.drawRectangle({ x: marginX, y: y - rowH + 4, width: 520, height: rowH, color: navy });
      page.drawText(no, { x: colX.no + 4, y: y - 10, font: bold, size: 9, color: rgb(1, 1, 1) });
      page.drawText(label, { x: colX.label, y: y - 10, font: bold, size: 9, color: rgb(1, 1, 1) });
      page.drawText("Biaya / Pcs", { x: colX.value - 60, y: y - 10, font: bold, size: 9, color: rgb(1, 1, 1) });
    } else {
      page.drawText(String(no), { x: colX.no + 4, y: y - 10, font, size: 9 });
      page.drawText(String(label), { x: colX.label, y: y - 10, font: isTotal ? bold : font, size: 9 });
      const txt = rp(value);
      const width = font.widthOfTextAtSize(txt, 9);
      page.drawText(txt, { x: 520 + marginX - width - 4, y: y - 10, font: isTotal ? bold : font, size: 9, color: isTotal ? navy : rgb(0, 0, 0) });
      page.drawLine({ start: { x: marginX, y: y - 12 }, end: { x: marginX + 520, y: y - 12 }, thickness: 0.3, color: grid });
    }
    y -= rowH;
  };

  drawRow("No", "Komponen", null, true);
  const comps = result?.components || [];
  comps.forEach((c, i) => {
    if (y < 100) {
      page = doc.addPage([595.28, 841.89]);
      y = 810;
      drawRow("No", "Komponen", null, true);
    }
    drawRow(i + 1, c.label, c.value);
  });

  y -= 8;
  const summary = [
    ["Subtotal HPP", result?.subtotal, true],
    [`Laba (${result?.labaPct || 0}%)`, result?.laba, false],
    [`Bunga (${result?.bungaPct || 0}%)`, result?.bunga, false],
    [`PPN (${result?.ppnPct || 0}%)`, result?.ppn, false],
    ["HARGA JUAL / PCS", result?.final, true],
  ];
  summary.forEach(([lab, val, isBold]) => {
    const line = String(lab);
    const txt = rp(val);
    const lw = font.widthOfTextAtSize(line, 10);
    page.drawText(line, { x: 520 + marginX - lw - 100, y, font: isBold ? bold : font, size: 10, color: isBold ? navy : rgb(0, 0, 0) });
    const vw = font.widthOfTextAtSize(txt, 10);
    page.drawText(txt, { x: 520 + marginX - vw - 4, y, font: isBold ? bold : font, size: 10, color: isBold ? navy : rgb(0, 0, 0) });
    y -= 16;
  });

  if (notes) {
    y -= 10;
    page.drawText("Catatan", { x: marginX, y, font: bold, size: 11, color: navy });
    y -= 14;
    const words = String(notes).split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line + (line ? " " : "") + w;
      if (font.widthOfTextAtSize(test, 10) > 500) {
        page.drawText(line, { x: marginX, y, font, size: 10 });
        line = w;
        y -= 14;
        if (y < 60) break;
      } else line = test;
    }
    if (line) { page.drawText(line, { x: marginX, y, font, size: 10 }); y -= 14; }
  }

  y -= 20;
  page.drawText("Dokumen dibuat otomatis oleh Kalkulator HPP SCA.", { x: marginX, y, font, size: 9, color: muted });

  return await doc.save();
}
