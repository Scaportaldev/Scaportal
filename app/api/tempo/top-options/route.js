import { handle, json, readJson, HttpError } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { ensureTopSeed, saveTopOptions, renameTopInInvoices } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "tempo");
  return json({ values: await ensureTopSeed() });
});

export const POST = handle(async (req) => {
  await requirePerm(req, "tempo");
  const body = await readJson(req);
  const v = String(body?.value ?? "").trim();
  if (!v) throw new HttpError(400, "Nilai opsi tidak boleh kosong");
  const values = await ensureTopSeed();
  if (!values.includes(v)) values.push(v);
  return json({ values: await saveTopOptions(values) });
});

export const PUT = handle(async (req) => {
  await requirePerm(req, "tempo");
  const body = await readJson(req);
  const old = String(body?.old_value ?? "");
  const next = String(body?.new_value ?? "").trim();
  if (!next) throw new HttpError(400, "Nilai baru tidak boleh kosong");
  if (old === "Cicilan") throw new HttpError(400, "Opsi 'Cicilan' tidak dapat diubah");

  let values = await ensureTopSeed();
  if (!values.includes(old)) throw new HttpError(404, "Opsi tidak ditemukan");
  if (next !== old && values.includes(next)) throw new HttpError(400, "Opsi sudah ada");

  values = values.map((v) => (v === old ? next : v));
  await saveTopOptions(values);
  await renameTopInInvoices(old, next);

  return json({ values });
});
