import { handle, json, readJson, HttpError } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { num, validateItemStatus, getItemOr404, updateItem, deleteItemCascade } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = handle(async (req, { params }) => {
  await requirePerm(req, "klien");
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
    const qty = num(body.kuantiti, -1);
    if (qty < 0) throw new HttpError(400, "Kuantiti tidak boleh negatif");
    updates.kuantiti = qty;
  }
  if (body?.status !== undefined && body.status !== null) {
    validateItemStatus(body.status);
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 0) throw new HttpError(400, "Tidak ada data yang diubah");

  await updateItem(id, updates);
  return json(await getItemOr404(id));
});

export const DELETE = handle(async (req, { params }) => {
  await requirePerm(req, "klien");
  const { id } = await params;
  await getItemOr404(id);
  await deleteItemCascade(id); // mutasi item ikut terhapus (FK cascade)
  return json({ ok: true });
});
