import { handle, pdfResponse, qp, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import {
  sortedInvoices, getInvoiceOr404, enrich,
  computeSummary, computeBreakdown, computeMonthly,
} from "@/server/tempo";
import {
  buildInvoicesPdf, buildInvoiceDetailPdf, buildTempoReportPdf,
} from "@/server/pdf/tempoPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const d = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : null);

export const GET = handle(async (req) => {
  await requireSuperadmin(req);
  const kind = qp(req, "kind") || "all";
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === "all") {
    const invoices = await sortedInvoices({
      search: qp(req, "search"),
      status: qp(req, "status"),
      sort_by: qp(req, "sort_by") || "due_date",
      order: qp(req, "order") || "asc",
    });
    const bytes = await buildInvoicesPdf({ invoices, periodLabel: "Seluruh data invoice" });
    return pdfResponse(bytes, `Jatuh_Tempo_Klien_${stamp}.pdf`);
  }

  if (kind === "detail") {
    const id = qp(req, "id");
    if (!id) throw new HttpError(400, "Parameter id wajib diisi");
    const invoice = enrich(await getInvoiceOr404(id));
    const name = String(invoice.invoice_number || invoice.client_name || "detail").replace(/[^\w.-]+/g, "-");
    const bytes = await buildInvoiceDetailPdf({ invoice });
    return pdfResponse(bytes, `Invoice_${name}.pdf`);
  }

  if (kind === "report") {
    const start = qp(req, "start");
    const end = qp(req, "end");
    const year = Number(qp(req, "year")) || new Date().getFullYear();
    const [summary, breakdown, monthly] = await Promise.all([
      computeSummary(start, end),
      computeBreakdown(start, end),
      computeMonthly(year),
    ]);
    const label = start || end ? `${d(start) || "awal"} s.d. ${d(end) || "sekarang"}` : `Tahun ${year}`;
    const bytes = await buildTempoReportPdf({ summary, breakdown, monthly, year, periodLabel: label });
    return pdfResponse(bytes, `Laporan_Jatuh_Tempo_${stamp}.pdf`);
  }

  throw new HttpError(404, "Jenis PDF tidak dikenal");
});
