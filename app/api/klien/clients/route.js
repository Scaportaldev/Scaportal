import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { newId, nowIso, listKliens, findKlienByNama, insertKlien } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  return json(await listKliens());
});

export const POST = handle(async (req) => {
  await requireAuth(req);
  const body = await readJson(req);
  const nama = String(body?.nama ?? "").trim();
  if (!nama) throw new HttpError(400, "Nama klien wajib diisi");

  const dup = await findKlienByNama(nama);
  if (dup) throw new HttpError(400, "Nama klien sudah terdaftar");

  const doc = { id: newId(), nama, created_at: nowIso() };
  await insertKlien(doc);
  return json(doc, 201);
});
