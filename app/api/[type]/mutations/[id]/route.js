import { handle, json, readJson, HttpError } from "@/server/http";
import { getCurrentUser, logAudit } from "@/server/auth";
import { getDb, stripId, nowIso } from "@/server/mongo";
import { collectionFor, buildDoc, assertStockAvailable, canModify } from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOrFail(collection, id) {
  const db = await getDb();
  const existing = await db.collection(collection).findOne({ id });
  if (!existing) throw new HttpError(404, "Mutasi tidak ditemukan");
  return existing;
}

export const PUT = handle(async (req, { params }) => {
  const current = await getCurrentUser(req);
  const { type, id } = await params;
  const collection = collectionFor(type);
  const existing = await loadOrFail(collection, id);

  const [ok, msg] = canModify(current, existing);
  if (!ok) throw new HttpError(403, msg);

  const body = await readJson(req);
  const newDoc = buildDoc(type, body);
  await assertStockAvailable(type, newDoc, id);

  const db = await getDb();
  await db.collection(collection).updateOne(
    { id },
    { $set: { ...newDoc, updated_at: nowIso() } },
  );
  const updated = stripId(await db.collection(collection).findOne({ id }));
  await logAudit(current, "edit", type, id, stripId(existing), updated);
  return json(updated);
});

export const DELETE = handle(async (req, { params }) => {
  const current = await getCurrentUser(req);
  const { type, id } = await params;
  const collection = collectionFor(type);
  const existing = await loadOrFail(collection, id);

  const [ok, msg] = canModify(current, existing);
  if (!ok) throw new HttpError(403, msg);

  const db = await getDb();
  await db.collection(collection).deleteOne({ id });
  await logAudit(current, "delete", type, id, stripId(existing), null);
  return json({ success: true });
});
