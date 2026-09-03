import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { newId, nowIso } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const db = await getDb();
  const rows = await db
    .collection(COL.klienClients)
    .find({}, { projection: { _id: 0 } })
    .sort({ nama: 1 })
    .limit(10000)
    .toArray();
  return json(rows);
});

export const POST = handle(async (req) => {
  await requireAuth(req);
  const body = await readJson(req);
  const nama = String(body?.nama ?? "").trim();
  if (!nama) throw new HttpError(400, "Nama klien wajib diisi");

  const db = await getDb();
  const dup = await db.collection(COL.klienClients).findOne({
    nama: { $regex: `^${nama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (dup) throw new HttpError(400, "Nama klien sudah terdaftar");

  const doc = { id: newId(), nama, created_at: nowIso() };
  await db.collection(COL.klienClients).insertOne({ ...doc });
  return json(doc, 201);
});
