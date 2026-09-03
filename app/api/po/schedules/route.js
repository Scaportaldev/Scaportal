import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL, stripId, nowIso } from "@/server/mongo";
import { STAGE_NAMES } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const db = await getDb();
  const docs = await db.collection(COL.poSchedules).find({}).sort({ date: 1 }).limit(3000).toArray();
  return json(docs.map(stripId));
});

export const POST = handle(async (req) => {
  await requireAuth(req);
  const body = await readJson(req);
  const poId = String(body.po_id || "");
  const stageNumber = Number(body.stage_number);
  const date = String(body.date || "");
  if (!poId || !stageNumber || !date) throw new HttpError(400, "PO, tahap, dan tanggal wajib diisi");

  const db = await getDb();
  const po = await db.collection(COL.pos).findOne({ id: poId });
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  const doc = {
    id: crypto.randomUUID(),
    po_id: poId,
    po_number: po.po_number,
    client_name: po.client_name,
    stage_number: stageNumber,
    stage_name: STAGE_NAMES[stageNumber] || "",
    date,
    note: String(body.note || ""),
    created_at: nowIso(),
  };
  await db.collection(COL.poSchedules).insertOne({ ...doc });
  return json(doc);
});
