import { handle, json, readJson, HttpError } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { getPoOr404, findKlienPoDup, updateKlienPo, deleteKlienPoCascade } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = handle(async (req, { params }) => {
  await requirePerm(req, "klien");
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

  if (updates.no_po && updates.no_po !== po.no_po) {
    const dup = await findKlienPoDup(po.klien_id, updates.no_po, id);
    if (dup) throw new HttpError(400, `No PO "${updates.no_po}" sudah ada untuk klien ini`);
  }

  await updateKlienPo(id, updates);
  return json(await getPoOr404(id));
});

export const DELETE = handle(async (req, { params }) => {
  await requirePerm(req, "klien");
  const { id } = await params;
  await getPoOr404(id);
  const deleted = await deleteKlienPoCascade(id);
  return json({ ok: true, deleted });
});
