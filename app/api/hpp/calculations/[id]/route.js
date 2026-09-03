import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL, stripId, nowIso } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const db = await getDb();
  const doc = await db.collection(COL.hppCalcs).findOne({ id });
  if (!doc) throw new HttpError(404, "Perhitungan tidak ditemukan");
  return json(stripId(doc));
});

export const PUT = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const body = await readJson(req);
  const db = await getDb();
  const existing = await db.collection(COL.hppCalcs).findOne({ id });
  if (!existing) throw new HttpError(404, "Perhitungan tidak ditemukan");
  const update = {
    name: String(body.name || existing.name).trim(),
    customer: String(body.customer || ""),
    notes: String(body.notes || ""),
    inputs: body.inputs || existing.inputs || {},
    result: body.result || existing.result || {},
    updated_at: nowIso(),
  };
  await db.collection(COL.hppCalcs).updateOne({ id }, { $set: update });
  const merged = { ...stripId(existing), ...update };
  return json(merged);
});

export const DELETE = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const db = await getDb();
  const res = await db.collection(COL.hppCalcs).deleteOne({ id });
  if (res.deletedCount === 0) throw new HttpError(404, "Perhitungan tidak ditemukan");
  return json({ ok: true });
});
