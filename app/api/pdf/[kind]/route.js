import { handle, pdfResponse, qp, HttpError } from "@/server/http";
import { requirePerm, requireSectionAccess } from "@/server/auth";
import { hasPermission } from "@/lib/permissions";
import { currentYear } from "@/server/db";
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
  "paper-mutations": { type: "paper", builder: paperMutationsPdf, file: "laporan-mutasi-kertas.pdf" },
  "ink-mutations": { type: "ink", builder: inkMutationsPdf, file: "laporan-mutasi-tinta.pdf" },
  "other-mutations": { type: "other", builder: otherMutationsPdf, file: "laporan-mutasi-lain.pdf" },
};

/** PDF Stok SCA boleh diunduh bila toggle "Download PDF" ON, atau user punya akses Tutup Tahun
 *  (proses tutup tahun mewajibkan unduh laporan dahulu). Superadmin selalu boleh. */
function canPdf(u) {
  return hasPermission(u, "stok_pdf") || hasPermission(u, "stok_tutup_tahun");
}

export const GET = handle(async (req, { params }) => {
  const { kind } = await params;
  const start = qp(req, "start");
  const end = qp(req, "end");
  const label = periodLabel(start, end);

  if (MUTATION_KINDS[kind]) {
    const u = await requirePerm(req, "stok");
    if (!canPdf(u)) throw new HttpError(403, "Anda tidak memiliki akses download PDF");
    const cfg = MUTATION_KINDS[kind];
    const rows = filterAsc(
      await allYear(cfg.type, currentYear()),
      { start, end, jenis: qp(req, "jenis"), transaksi: qp(req, "transaksi"), supplier: qp(req, "supplier") },
      cfg.type,
    );
    return pdfResponse(await cfg.builder(rows, label), cfg.file);
  }

  if (kind === "stock-ringkas") {
    const u = await requirePerm(req, "stok");
    if (!canPdf(u)) throw new HttpError(403, "Anda tidak memiliki akses download PDF");
    const stock = await computeStock();
    return pdfResponse(
      await stockSummaryPdf(stock, `Tahun ${currentYear()}`),
      "laporan-stok-ringkas.pdf",
    );
  }

  if (kind === "detail") {
    const u = await requireSectionAccess(req, "stok_detail");
    if (!canPdf(u)) throw new HttpError(403, "Anda tidak memiliki akses download PDF");
    const detail = await computeDetail(start, end);
    return pdfResponse(await detailReportPdf(detail, label), "laporan-detail.pdf");
  }

  if (kind === "stock-nominal") {
    // Dipakai Laporan Detail maupun Tutup Tahun (langkah 1 wajib unduh laporan nominal).
    const u = await requireSectionAccess(req);
    if (!hasPermission(u, "stok_detail") && !hasPermission(u, "stok_tutup_tahun")) {
      throw new HttpError(403, "Anda tidak memiliki akses ke tools ini");
    }
    if (!canPdf(u)) throw new HttpError(403, "Anda tidak memiliki akses download PDF");
    const [stock, detail] = await Promise.all([computeStock(), computeDetail(start, end)]);
    return pdfResponse(
      await stockSummaryPdf(stock, label, detail),
      "laporan-stok-keseluruhan.pdf",
    );
  }

  throw new HttpError(404, "Jenis laporan PDF tidak dikenal");
});
