import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { getKlienOr404 } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const body = await readJson(req);
  const nama = String(body?.nama ?? "").trim();
  if (!nama) throw new HttpError(400, "Nama klien wajib diisi");
  await getKlienOr404(id);

  const db = await getDb();
  const dup = await db.collection(COL.klienClients).findOne({
    id: { $ne: id },
    nama: { $regex: `^${nama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (dup) throw new HttpError(400, "Nama klien sudah terdaftar");

  await db.collection(COL.klienClients).updateOne({ id }, { $set: { nama } });
  return json(await db.collection(COL.klienClients).findOne({ id }, { projection: { _id: 0 } }));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  await getKlienOr404(id);
  const db = await getDb();

  const pos = await db.collection(COL.klienPos).find({ klien_id: id }, { projection: { _id: 0, id: 1 } }).toArray();
  const poIds = pos.map((p) => p.id);
  const items = await db
    .collection(COL.klienItems)
    .find({ po_id: { $in: poIds } }, { projection: { _id: 0, id: 1 } })
    .toArray();
  const itemIds = items.map((i) => i.id);

  await db.collection(COL.klienMutations).deleteMany({ item_id: { $in: itemIds } });
  await db.collection(COL.klienItems).deleteMany({ po_id: { $in: poIds } });
  await db.collection(COL.klienPos).deleteMany({ klien_id: id });
  await db.collection(COL.klienClients).deleteOne({ id });

  return json({ ok: true, deleted: { pos: poIds.length, items: itemIds.length } });
});
