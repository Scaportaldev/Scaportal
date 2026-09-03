import { handle, json, HttpError } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { getAudit } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Detail satu log audit (before/after) — dimuat saat user membuka perbandingan. */
export const GET = handle(async (req, { params }) => {
  await requireSectionAccess(req, "logs");
  const { id } = await params;
  const row = await getAudit(id);
  if (!row) throw new HttpError(404, "Log audit tidak ditemukan");
  return json(row);
});
