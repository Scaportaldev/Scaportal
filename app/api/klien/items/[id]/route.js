import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { num, validateItemStatus, getItemOr404 } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  await getItemOr404(id);
  const body = await readJson(req);

  const updates = {};
  if (body?.jenis_item !== undefined && body.jenis_item !== null) {
    const v = String(body.jenis_item).trim();
    if (!v) throw new HttpError(400, "Jenis item wajib diisi");
    updates.jenis_item = v;
  }
  if (body?.satuan !== undefined && body.satuan !== null) updates.satuan = String(body.satuan).trim();
  if (body?.keterangan !== undefined && body.keterangan !== null) updates.keterangan = String(body.keterangan);
  if (body?.kuantiti !== undefined && body.kuantiti !== null) {
    const q = num(body.kuantiti, -1);
    if (q < 0) throw new HttpError(400, "Kuantiti tidak boleh negatif");
    updates.kuantiti = q;
  }
  if (body?.status !== undefined && body.status !== null) {
    validateItemStatus(body.status);
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 0) throw new HttpError(400, "Tidak ada data yang diubah");

  const db = await getDb();
  await db.collection(COL.klienItems).updateOne({ id }, { $set: updates });
  return json(await db.collection(COL.klienItems).findOne({ id }, { projection: { _id: 0 } }));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  await getItemOr404(id);
  const db = await getDb();
  await db.collection(COL.klienMutations).deleteMany({ item_id: id });
  await db.collection(COL.klienItems).deleteOne({ id });
  return json({ ok: true });
});
