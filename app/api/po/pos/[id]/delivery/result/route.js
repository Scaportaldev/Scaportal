import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { nowIso } from "@/server/db";
import { getPo, updatePo } from "@/server/po/repo";
import { enrichPo } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const current = await requireAuth(req);
  const { id } = await params;
  const body = await readJson(req);
  const status = String(body.status || "");
  if (!(["success", "failed"].includes(status))) throw new HttpError(400, "Status tidak valid");

  const po = await getPo(id);
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  const stageData = po.stage_data || {};
  const d11 = stageData["11"] || {};
  const attempts = d11.delivery_attempts || [];
  if (!attempts.length) throw new HttpError(400, "Belum ada jadwal kirim");
  const last = attempts[attempts.length - 1];
  last.status = status;
  last.failure_reason = status === "failed" ? String(body.failure_reason || "") : "";
  last.result_at = nowIso();
  d11.delivery_attempts = attempts;
  stageData["11"] = d11;

  const now = nowIso();
  const msg = `Pengiriman ${status === "success" ? "BERHASIL" : "GAGAL"}${status === "failed" ? ` (alasan: ${last.failure_reason})` : ""} - dicatat oleh ${current.username}`;

  await updatePo(id, { stage_data: stageData, updated_at: now }, [{ timestamp: now, message: msg, user: current.username }]);
  return json(enrichPo(await getPo(id)));
});
