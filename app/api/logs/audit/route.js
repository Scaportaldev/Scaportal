import { handle, json, pageParams, paged } from "@/server/http";
import { requireSectionAccess, requireSuperadmin, logAudit } from "@/server/auth";
import { listAudit, clearAudit } from "@/server/logs";

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

/**
 * DELETE /api/logs/audit — bersihkan log audit mutasi (khusus Superadmin).
 * Satu catatan audit pembersihan tetap tercatat sebagai jejak.
 */
export const DELETE = handle(async (req) => {
  const current = await requireSuperadmin(req);
  const deleted = await clearAudit();
  await logAudit(current, "delete", "log", null, { keterangan: "Bersihkan Log Audit Mutasi", jumlah_dihapus: deleted }, null);
  return json({ deleted });
});
