import { handle, pdfResponse, qp, HttpError } from "@/server/http";
import { getCurrentUser, requireSectionAccess } from "@/server/auth";
import { COL, currentYear } from "@/server/mongo";
import { allYear, computeStock, computeDetail } from "@/server/reports";
import { NAME_FIELD } from "@/server/mutations";
import { formatDateId } from "@/server/format";
import {
  paperMutationsPdf, inkMutationsPdf, otherMutationsPdf, stockSummaryPdf, detailReportPdf,
} from "@/server/pdf/builders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodLabel(start, end) {
  const y = currentYear();
  const s = start || `${y}-01-01`;
  const e = end || new Date().toISOString().slice(0, 10);
  return `${formatDateId(s)} s.d. ${formatDateId(e)}`;
}

function filterAsc(rows, { start, end, jenis, transaksi, supplier }, type) {
  const nameField = NAME_FIELD[type];
  const out = rows.filter((d) => {
    if (start && d.date < start) return false;
    if (end && d.date > end) return false;
    if (jenis && d[nameField] !== jenis) return false;
    if (transaksi && d.jenis_transaksi !== transaksi) return false;
    if (supplier && !String(d.supplier || "").toLowerCase().includes(supplier.toLowerCase())) return false;
    return true;
  });
  out.sort((a, b) => `${a.date}${a.created_at || ""}`.localeCompare(`${b.date}${b.created_at || ""}`));
  return out;
}

const MUTATION_KINDS = {
  "paper-mutations": { type: "paper", collection: COL.paper, builder: paperMutationsPdf, file: "laporan-mutasi-kertas.pdf" },
  "ink-mutations": { type: "ink", collection: COL.ink, builder: inkMutationsPdf, file: "laporan-mutasi-tinta.pdf" },
  "other-mutations": { type: "other", collection: COL.other, builder: otherMutationsPdf, file: "laporan-mutasi-lain.pdf" },
};

export const GET = handle(async (req, { params }) => {
  const { kind } = await params;
  const start = qp(req, "start");
  const end = qp(req, "end");
  const label = periodLabel(start, end);

  if (MUTATION_KINDS[kind]) {
    await getCurrentUser(req);
    const cfg = MUTATION_KINDS[kind];
    const rows = filterAsc(
      await allYear(cfg.collection, currentYear()),
      { start, end, jenis: qp(req, "jenis"), transaksi: qp(req, "transaksi"), supplier: qp(req, "supplier") },
      cfg.type,
    );
    return pdfResponse(await cfg.builder(rows, label), cfg.file);
  }

  if (kind === "stock-ringkas") {
    await getCurrentUser(req);
    const stock = await computeStock();
    return pdfResponse(
      await stockSummaryPdf(stock, `Tahun ${currentYear()}`),
      "laporan-stok-ringkas.pdf",
    );
  }

  if (kind === "detail") {
    await requireSectionAccess(req);
    const detail = await computeDetail(start, end);
    return pdfResponse(await detailReportPdf(detail, label), "laporan-detail.pdf");
  }

  if (kind === "stock-nominal") {
    await requireSectionAccess(req);
    const [stock, detail] = await Promise.all([computeStock(), computeDetail(start, end)]);
    return pdfResponse(
      await stockSummaryPdf(stock, label, detail),
      "laporan-stok-keseluruhan.pdf",
    );
  }

  throw new HttpError(404, "Jenis laporan PDF tidak dikenal");
});
