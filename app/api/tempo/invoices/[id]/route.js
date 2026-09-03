import { handle, json, readJson } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { getInvoiceOr404, buildInvoicePayload, enrich } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  return json(enrich(await getInvoiceOr404(id)));
});

export const PUT = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const existing = await getInvoiceOr404(id);
  const body = await readJson(req);
  const update = buildInvoicePayload(body, existing);
  const db = await getDb();
  await db.collection(COL.tempoInvoices).updateOne({ id }, { $set: update });
  return json(enrich(await db.collection(COL.tempoInvoices).findOne({ id })));
});

export const DELETE = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  await getInvoiceOr404(id);
  const db = await getDb();
  await db.collection(COL.tempoInvoices).deleteOne({ id });
  return json({ ok: true });
});
