import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";
import { enrichPo } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const current = await requireAuth(req);
  const { id } = await params;
  const body = await readJson(req);
  const db = await getDb();
  const po = await db.collection(COL.pos).findOne({ id });
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  const stageData = po.stage_data || {};
  const d11 = stageData["11"] || {};
  const attempts = d11.delivery_attempts || [];
  attempts.push({
    id: crypto.randomUUID(),
    scheduled_date: body.scheduled_date || null,
    driver_name: String(body.driver_name || ""),
    status: "waiting",
    failure_reason: "",
    created_at: nowIso(),
  });
  d11.delivery_attempts = attempts;
  stageData["11"] = d11;

  const now = nowIso();
  const logs = po.logs || [];
  logs.push({ timestamp: now, message: `Jadwal kirim dibuat (${body.scheduled_date || "-"}, supir: ${body.driver_name || "-"}) oleh ${current.username}`, user: current.username });
  await db.collection(COL.pos).updateOne({ id }, { $set: { stage_data: stageData, logs, updated_at: now } });
  const updated = await db.collection(COL.pos).findOne({ id });
  return json(enrichPo(updated));
});
