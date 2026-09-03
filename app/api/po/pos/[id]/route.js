import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";
import { enrichPo } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const db = await getDb();
  const doc = await db.collection(COL.pos).findOne({ id });
  if (!doc) throw new HttpError(404, "PO tidak ditemukan");
  return json(enrichPo(doc));
});

export const PUT = handle(async (req, { params }) => {
  const current = await requireAuth(req);
  const { id } = await params;
  const body = await readJson(req);
  const db = await getDb();
  const existing = await db.collection(COL.pos).findOne({ id });
  if (!existing) throw new HttpError(404, "PO tidak ditemukan");

  const newNum = String(body.po_number || existing.po_number).trim();
  if (newNum !== existing.po_number) {
    const dup = await db.collection(COL.pos).findOne({ po_number: newNum });
    if (dup) throw new HttpError(400, "Nomor PO sudah ada");
  }

  const enabledStages = Array.isArray(body.enabled_stages) ? body.enabled_stages.map(Number).filter((n) => n >= 1 && n <= 11) : existing.enabled_stages || [];
  const oldStageData = existing.stage_data || {};
  const mergedStage = { ...oldStageData };
  enabledStages.forEach((n) => { if (!mergedStage[String(n)]) mergedStage[String(n)] = {}; });

  const now = nowIso();
  const logs = existing.logs || [];
  logs.push({ timestamp: now, message: `PO diperbarui oleh ${current.name || current.username}`, user: current.username });

  const update = {
    po_number: newNum,
    client_name: String(body.client_name || existing.client_name),
    item_type: String(body.item_type ?? existing.item_type ?? ""),
    material: String(body.material ?? existing.material ?? ""),
    paper_size: String(body.paper_size ?? existing.paper_size ?? ""),
    quantity: String(body.quantity ?? existing.quantity ?? ""),
    po_date: body.po_date ?? existing.po_date ?? null,
    est_start: body.est_start ?? existing.est_start ?? null,
    est_end: body.est_end ?? existing.est_end ?? null,
    print_machine: body.print_machine ?? existing.print_machine ?? null,
    enabled_stages: enabledStages,
    stage_data: mergedStage,
    notes: String(body.notes ?? existing.notes ?? ""),
    logs,
    updated_at: now,
  };
  await db.collection(COL.pos).updateOne({ id }, { $set: update });
  const merged = { ...existing, ...update };
  return json(enrichPo(merged));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const db = await getDb();
  const existing = await db.collection(COL.pos).findOne({ id });
  if (!existing) throw new HttpError(404, "PO tidak ditemukan");
  await db.collection(COL.pos).deleteOne({ id });
  await db.collection(COL.poSchedules).deleteMany({ po_id: id });
  return json({ ok: true });
});
