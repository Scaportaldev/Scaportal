import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { getPoOr404 } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const po = await getPoOr404(id);
  const body = await readJson(req);

  const updates = {};
  if (body?.no_po !== undefined && body.no_po !== null) {
    const noPo = String(body.no_po).trim();
    if (!noPo) throw new HttpError(400, "No PO wajib diisi");
    updates.no_po = noPo;
  }
  if (body?.tanggal_po) updates.tanggal_po = body.tanggal_po;
  if (Object.keys(updates).length === 0) throw new HttpError(400, "Tidak ada data yang diubah");

  const db = await getDb();
  if (updates.no_po && updates.no_po !== po.no_po) {
    const dup = await db.collection(COL.klienPos).findOne({
      id: { $ne: id },
      klien_id: po.klien_id,
      no_po: updates.no_po,
    });
    if (dup) throw new HttpError(400, `No PO "${updates.no_po}" sudah ada untuk klien ini`);
  }

  await db.collection(COL.klienPos).updateOne({ id }, { $set: updates });
  return json(await db.collection(COL.klienPos).findOne({ id }, { projection: { _id: 0 } }));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  await getPoOr404(id);
  const db = await getDb();

  const items = await db.collection(COL.klienItems).find({ po_id: id }, { projection: { _id: 0, id: 1 } }).toArray();
  const itemIds = items.map((i) => i.id);
  await db.collection(COL.klienMutations).deleteMany({ item_id: { $in: itemIds } });
  await db.collection(COL.klienItems).deleteMany({ po_id: id });
  await db.collection(COL.klienPos).deleteOne({ id });

  return json({ ok: true, deleted: { items: itemIds.length } });
});
