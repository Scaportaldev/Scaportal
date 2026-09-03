import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { getInvoiceOr404, enrich, num, newId, nowIso } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const inv = await getInvoiceOr404(id);
  const body = await readJson(req);

  const amount = num(body?.amount);
  if (amount <= 0) throw new HttpError(400, "Nominal cicilan harus lebih dari 0");

  const installments = [...(inv.installments || [])];
  installments.push({
    id: newId(),
    sequence: Number(body?.sequence) || installments.length + 1,
    amount,
    date: body?.date || new Date().toISOString().slice(0, 10),
  });

  const total = num(inv.total_amount);
  const paid = installments.reduce((s, i) => s + num(i.amount), 0);
  const update = { installments, updated_at: nowIso() };
  if (total > 0 && paid >= total) update.status = "lunas";

  const db = await getDb();
  await db.collection(COL.tempoInvoices).updateOne({ id }, { $set: update });
  return json(enrich(await db.collection(COL.tempoInvoices).findOne({ id })));
});
