import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { getInvoiceOr404, enrich, STATUSES, nowIso } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  await getInvoiceOr404(id);
  const body = await readJson(req);
  const status = String(body?.status ?? "");
  if (!STATUSES.includes(status)) throw new HttpError(400, "Status harus 'lunas' atau 'belum_lunas'");

  const db = await getDb();
  await db
    .collection(COL.tempoInvoices)
    .updateOne({ id }, { $set: { status, updated_at: nowIso() } });
  return json(enrich(await db.collection(COL.tempoInvoices).findOne({ id })));
});
