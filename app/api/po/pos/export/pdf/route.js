import { handle, qp, pdfResponse } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { listPos } from "@/server/po/repo";
import { enrichPo, filterPos } from "@/server/po/stages";
import { buildPoRekapPdf } from "@/server/pdf/poPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "po");
  const search = qp(req, "search");
  const bucket = qp(req, "bucket");
  const month = qp(req, "month");
  const docs = await listPos({ limit: 2000, withLogs: true });
  const enriched = docs.map(enrichPo);
  const filtered = filterPos(enriched, search, bucket, month);
  const bytes = await buildPoRekapPdf({ pos: filtered, month });
  const fname = `Rekap_PO_SCA${month ? "_" + month : ""}.pdf`;
  return pdfResponse(bytes, fname);
});
