import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL, stripId, nowIso } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSuperadmin(req);
  const db = await getDb();
  const docs = await db.collection(COL.hppCalcs).find({}).sort({ updated_at: -1 }).limit(500).toArray();
  return json(docs.map(stripId));
});

export const POST = handle(async (req) => {
  const current = await requireSuperadmin(req);
  const body = await readJson(req);
  if (!body.name || !String(body.name).trim()) throw new HttpError(400, "Nama perhitungan wajib diisi");
  const now = nowIso();
  const doc = {
    id: crypto.randomUUID(),
    name: String(body.name).trim(),
    customer: String(body.customer || ""),
    notes: String(body.notes || ""),
    inputs: body.inputs || {},
    result: body.result || {},
    owner_id: current.id,
    owner_name: current.name,
    created_at: now,
    updated_at: now,
  };
  const db = await getDb();
  await db.collection(COL.hppCalcs).insertOne({ ...doc });
  return json(doc);
});
