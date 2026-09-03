import { handle, json } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { getInvoiceOr404, enrich, nowIso } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id, insId } = await params;
  const inv = await getInvoiceOr404(id);
  const installments = (inv.installments || []).filter((i) => i.id !== insId);
  const db = await getDb();
  await db
    .collection(COL.tempoInvoices)
    .updateOne({ id }, { $set: { installments, updated_at: nowIso() } });
  return json(enrich(await db.collection(COL.tempoInvoices).findOne({ id })));
});
