import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";
import { enrichPo, isStageDone, STAGE_NAMES } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/po/pos/[id]/stages/[num]  — update stage_data[num]
export const POST = handle(async (req, { params }) => {
  const current = await requireAuth(req);
  const { id, num } = await params;
  const stageNum = Number(num);
  if (!(stageNum >= 1 && stageNum <= 11)) throw new HttpError(400, "Nomor tahap tidak valid");

  const body = await readJson(req);
  const patch = body.data || {};

  const db = await getDb();
  const po = await db.collection(COL.pos).findOne({ id });
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  const stageData = po.stage_data || {};
  const prev = stageData[String(stageNum)] || {};
  const wasDone = isStageDone(po, stageNum);
  const newData = { ...prev, ...patch };
  stageData[String(stageNum)] = newData;
  const merged = { ...po, stage_data: stageData };
  const nowDone = isStageDone(merged, stageNum);

  const now = nowIso();
  const logs = po.logs || [];
  if (nowDone && !wasDone) {
    newData.completed_at = now;
    logs.push({ timestamp: now, message: `Tahap ${stageNum} - ${STAGE_NAMES[stageNum]} ditandai SELESAI oleh ${current.username}`, user: current.username });
  } else if (!nowDone && wasDone) {
    delete newData.completed_at;
    logs.push({ timestamp: now, message: `Tahap ${stageNum} - ${STAGE_NAMES[stageNum]} dibuka kembali oleh ${current.username}`, user: current.username });
  } else {
    logs.push({ timestamp: now, message: `Tahap ${stageNum} - ${STAGE_NAMES[stageNum]} diperbarui oleh ${current.username}`, user: current.username });
  }

  await db.collection(COL.pos).updateOne({ id }, { $set: { stage_data: stageData, logs, updated_at: now } });
  const updated = await db.collection(COL.pos).findOne({ id });
  return json(enrichPo(updated));
});
