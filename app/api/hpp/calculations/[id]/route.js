import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { nowIso } from "@/server/db";
import { getCalculation, updateCalculation, deleteCalculation } from "@/server/hpp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const doc = await getCalculation(id);
  if (!doc) throw new HttpError(404, "Perhitungan tidak ditemukan");
  return json(doc);
});

export const PUT = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const body = await readJson(req);
  const existing = await getCalculation(id);
  if (!existing) throw new HttpError(404, "Perhitungan tidak ditemukan");
  const update = {
    name: String(body.name || existing.name).trim(),
    customer: String(body.customer || ""),
    notes: String(body.notes || ""),
    inputs: body.inputs || existing.inputs || {},
    result: body.result || existing.result || {},
    updated_at: nowIso(),
  };
  await updateCalculation(id, update);
  return json({ ...existing, ...update });
});

export const DELETE = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const deleted = await deleteCalculation(id);
  if (!deleted) throw new HttpError(404, "Perhitungan tidak ditemukan");
  return json({ ok: true });
});
