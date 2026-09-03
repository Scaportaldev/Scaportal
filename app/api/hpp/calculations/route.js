import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { nowIso } from "@/server/db";
import { listCalculations, insertCalculation } from "@/server/hpp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSuperadmin(req);
  return json(await listCalculations(500));
});

export const POST = handle(async (req) => {
  const current = await requireSuperadmin(req);
  const body = await readJson(req);
  if (!body.name || !String(body.name).trim()) throw new HttpError(400, "Nama perhitungan wajib diisi");
  const now = nowIso();
  const doc = {
    id: crypto.randomUUID(),
    name: String(body.name).trim(),
    customer: String(body.customer || ""),
    notes: String(body.notes || ""),
    inputs: body.inputs || {},
    result: body.result || {},
    owner_id: current.id,
    owner_name: current.name,
    created_at: now,
    updated_at: now,
  };
  await insertCalculation(doc);
  return json(doc);
});
