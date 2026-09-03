import { handle, json, readJson, HttpError } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { nowIso } from "@/server/db";
import { getPo, updatePo } from "@/server/po/repo";
import { enrichPo, isStageDone, STAGE_NAMES } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/po/pos/[id]/stages/[num]  — update stage_data[num]
export const POST = handle(async (req, { params }) => {
  const current = await requirePerm(req, "po");
  const { id, num } = await params;
  const stageNum = Number(num);
  if (!(stageNum >= 1 && stageNum <= 11)) throw new HttpError(400, "Nomor tahap tidak valid");

  const body = await readJson(req);
  const patch = body.data || {};

  const po = await getPo(id);
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  const stageData = po.stage_data || {};
  const prev = stageData[String(stageNum)] || {};
  const wasDone = isStageDone(po, stageNum);
  const newData = { ...prev, ...patch };
  stageData[String(stageNum)] = newData;
  const merged = { ...po, stage_data: stageData };
  const nowDone = isStageDone(merged, stageNum);

  const now = nowIso();
  let message;
  if (nowDone && !wasDone) {
    newData.completed_at = now;
    message = `Tahap ${stageNum} - ${STAGE_NAMES[stageNum]} ditandai SELESAI oleh ${current.username}`;
  } else if (!nowDone && wasDone) {
    delete newData.completed_at;
    message = `Tahap ${stageNum} - ${STAGE_NAMES[stageNum]} dibuka kembali oleh ${current.username}`;
  } else {
    message = `Tahap ${stageNum} - ${STAGE_NAMES[stageNum]} diperbarui oleh ${current.username}`;
  }

  await updatePo(id, { stage_data: stageData, updated_at: now }, [{ timestamp: now, message, user: current.username }]);
  return json(enrichPo(await getPo(id)));
});
