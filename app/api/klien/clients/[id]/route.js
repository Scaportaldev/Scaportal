import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getKlienOr404, findKlienByNama, updateKlien, deleteKlienCascade } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const body = await readJson(req);
  const nama = String(body?.nama ?? "").trim();
  if (!nama) throw new HttpError(400, "Nama klien wajib diisi");
  await getKlienOr404(id);

  const dup = await findKlienByNama(nama, id);
  if (dup) throw new HttpError(400, "Nama klien sudah terdaftar");

  await updateKlien(id, { nama });
  return json(await getKlienOr404(id));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  await getKlienOr404(id);
  const deleted = await deleteKlienCascade(id);
  return json({ ok: true, deleted });
});
