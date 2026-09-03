import { handle, json, pageParams, paged } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { listAudit } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/logs/audit
 *   tanpa ?page      -> array lengkap (maks 1000) — kompatibel dengan skrip lama
 *   ?page=&page_size -> { items, total, ... } ringan (tanpa JSON before/after);
 *                       detail per baris: GET /api/logs/audit/:id
 */
export const GET = handle(async (req) => {
  await requireSectionAccess(req, "logs");
  const pg = pageParams(req);
  if (!pg) return json(await listAudit(1000));
  const { items, total } = await listAudit(pg);
  return json(paged(items, total, pg));
});
