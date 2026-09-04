import { handle, json, pageParams, paged } from "@/server/http";
import { requireSectionAccess, requireSuperadmin, logAudit } from "@/server/auth";
import { listActivity, clearActivity } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/logs/activity — array (lama) atau { items, total } bila ?page= dikirim. */
export const GET = handle(async (req) => {
  await requireSectionAccess(req, "logs");
  const pg = pageParams(req);
  if (!pg) return json(await listActivity(1000));
  const { items, total } = await listActivity(pg);
  return json(paged(items, total, pg));
});

/**
 * DELETE /api/logs/activity — bersihkan SEMUA log aktivitas (khusus Superadmin).
 * Aksi tercatat di log audit.
 */
export const DELETE = handle(async (req) => {
  const current = await requireSuperadmin(req);
  const deleted = await clearActivity();
  await logAudit(current, "delete", "log", null, { keterangan: "Bersihkan Log Aktivitas", jumlah_dihapus: deleted }, null);
  return json({ deleted });
});
