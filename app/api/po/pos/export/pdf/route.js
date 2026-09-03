import { handle, qp, pdfResponse } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { enrichPo, filterPos } from "@/server/po/stages";
import { buildPoRekapPdf } from "@/server/pdf/poPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const search = qp(req, "search");
  const bucket = qp(req, "bucket");
  const month = qp(req, "month");
  const db = await getDb();
  const docs = await db.collection(COL.pos).find({}).limit(2000).toArray();
  const enriched = docs.map(enrichPo);
  const filtered = filterPos(enriched, search, bucket, month);
  const bytes = await buildPoRekapPdf({ pos: filtered, month });
  const fname = `Rekap_PO_SCA${month ? "_" + month : ""}.pdf`;
  return pdfResponse(bytes, fname);
});
