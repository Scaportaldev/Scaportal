import { handle, json, readJson, HttpError } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { nowIso } from "@/server/db";
import { getPo, listSchedules, insertSchedule } from "@/server/po/repo";
import { STAGE_NAMES } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "po");
  return json(await listSchedules(3000));
});

export const POST = handle(async (req) => {
  await requirePerm(req, "po");
  const body = await readJson(req);
  const poId = String(body.po_id || "");
  const stageNumber = Number(body.stage_number);
  const date = String(body.date || "");
  if (!poId || !stageNumber || !date) throw new HttpError(400, "PO, tahap, dan tanggal wajib diisi");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Format tanggal tidak valid");

  const po = await getPo(poId);
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  const doc = {
    id: crypto.randomUUID(),
    po_id: poId,
    po_number: po.po_number,
    client_name: po.client_name,
    stage_number: stageNumber,
    stage_name: STAGE_NAMES[stageNumber] || "",
    date,
    note: String(body.note || ""),
    created_at: nowIso(),
  };
  await insertSchedule(doc);
  return json(doc);
});
