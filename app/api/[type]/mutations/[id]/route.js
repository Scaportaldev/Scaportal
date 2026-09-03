import { handle, json, readJson, HttpError } from "@/server/http";
import { getCurrentUser, logAudit } from "@/server/auth";
import { nowIso } from "@/server/db";
import {
  buildDoc, assertStockAvailable, canModify, getMutation, updateMutation, deleteMutation,
} from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOrFail(type, id) {
  const existing = await getMutation(type, id);
  if (!existing) throw new HttpError(404, "Mutasi tidak ditemukan");
  return existing;
}

export const PUT = handle(async (req, { params }) => {
  const current = await getCurrentUser(req);
  const { type, id } = await params;
  const existing = await loadOrFail(type, id);

  const [ok, msg] = canModify(current, existing);
  if (!ok) throw new HttpError(403, msg);

  const body = await readJson(req);
  const newDoc = buildDoc(type, body);
  await assertStockAvailable(type, newDoc, id);

  await updateMutation(type, id, { ...newDoc, updated_at: nowIso() });
  const updated = await getMutation(type, id);
  await logAudit(current, "edit", type, id, existing, updated);
  return json(updated);
});

export const DELETE = handle(async (req, { params }) => {
  const current = await getCurrentUser(req);
  const { type, id } = await params;
  const existing = await loadOrFail(type, id);

  const [ok, msg] = canModify(current, existing);
  if (!ok) throw new HttpError(403, msg);

  await deleteMutation(type, id);
  await logAudit(current, "delete", type, id, existing, null);
  return json({ success: true });
});
