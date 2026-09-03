import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

function wrapText(text, font, size, maxWidth) {
  if (!text) return [""];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildPoRekapPdf({ pos, month }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(29 / 255, 78 / 255, 216 / 255);
  const grid = rgb(203 / 255, 213 / 255, 225 / 255);
  const zebra = rgb(241 / 255, 245 / 255, 249 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);

  // Landscape A4
  const pageW = 841.89, pageH = 595.28;
  const marginX = 22, topY = 570;
  let page = doc.addPage([pageW, pageH]);
  let y = topY;

  const title = "Rekap Purchase Order — SCA";
  page.drawText(title, { x: marginX, y, font: bold, size: 18, color: navy });
  y -= 18;
  const now = new Date();
  const scope = month ? `Bulan: ${monthLabel(month)}` : "Semua Bulan";
  const sub = `${scope}  •  Total PO: ${pos.length}  •  Dicetak: ${now.toLocaleDateString("id-ID")} ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
  page.drawText(sub, { x: marginX, y, font, size: 9, color: muted });
  y -= 18;

  if (!pos.length) {
    page.drawText("Tidak ada data PO untuk filter ini.", { x: marginX, y: y - 20, font, size: 11 });
    return await doc.save();
  }

  // Group by month
  const groups = new Map();
  for (const p of pos) {
    const mk = poMonth(p);
    if (!groups.has(mk)) groups.set(mk, []);
    groups.get(mk).push(p);
  }
  const monthKeys = [...groups.keys()].sort().reverse();

  const headers = ["No PO", "Klien", "Item", "Bahan", "Qty", "Est Produksi", "Mesin", "Status"];
  const colWidths = [70, 115, 100, 90, 45, 145, 82, 105];
  const colX = [];
  {
    let x = marginX;
    for (const w of colWidths) { colX.push(x); x += w; }
  }
  const rowSize = 8;

  function newPage() {
    page = doc.addPage([pageW, pageH]);
    y = topY;
  }

  function drawHeader() {
    page.drawRectangle({ x: marginX, y: y - 16, width: colWidths.reduce((a, b) => a + b, 0), height: 16, color: navy });
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i] + 4, y: y - 11, font: bold, size: 8, color: rgb(1, 1, 1) });
    });
    y -= 16;
  }

  for (const mk of monthKeys) {
    if (y < 80) newPage();
    const rows = groups.get(mk).slice().sort((a, b) => (a.po_date || a.est_start || "").localeCompare(b.po_date || b.est_start || ""));
    page.drawText(`${monthLabel(mk)}  (${rows.length} PO)`, { x: marginX, y, font: bold, size: 11 });
    y -= 8;
    drawHeader();

    let zebraOn = false;
    for (const p of rows) {
      if (y < 40) { newPage(); drawHeader(); zebraOn = false; }
      const c = p.computed || computeStatus(p);
      const est = `${fmtDate(p.est_start)} s/d ${fmtDate(p.est_end)}`;
      const status = BUCKET_LABELS[c.bucket] || c.bucket;
      const cells = [
        p.po_number || "",
        p.client_name || "-",
        p.item_type || "-",
        p.material || "-",
        String(p.quantity || "-"),
        est,
        p.print_machine || "-",
        status,
      ];
      // Wrap each cell to lines
      const wrapped = cells.map((c, i) => wrapText(String(c), font, rowSize, colWidths[i] - 8));
      const rowLines = Math.max(...wrapped.map((w) => w.length));
      const rowH = rowLines * 10 + 4;
      if (zebraOn) page.drawRectangle({ x: marginX, y: y - rowH, width: colWidths.reduce((a, b) => a + b, 0), height: rowH, color: zebra });
      wrapped.forEach((lines, i) => {
        lines.forEach((ln, li) => {
          page.drawText(ln, { x: colX[i] + 4, y: y - 10 - li * 10, font, size: rowSize });
        });
      });
      page.drawLine({ start: { x: marginX, y: y - rowH }, end: { x: marginX + colWidths.reduce((a, b) => a + b, 0), y: y - rowH }, thickness: 0.4, color: grid });
      y -= rowH;
      zebraOn = !zebraOn;
    }
    y -= 14;
  }

  return await doc.save();
}
