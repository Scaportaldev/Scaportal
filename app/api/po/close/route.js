import { handle, json } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { query, queryOne, nowIso } from "@/server/db";
import { insertAudit } from "@/server/logs";
import { deleteObject, isR2Ready } from "@/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/po/close — "Tutup PO" (khusus Superadmin).
 * Konsep seperti Tutup Tahun: frontend mewajibkan unduh PDF rekap dulu,
 * lalu endpoint ini menghapus SEMUA data PO Tracker:
 * pos (+ po_logs, po_schedules, po_files via FK CASCADE) + foto di R2 (best-effort).
 */
export const POST = handle(async (req) => {
  const current = await requireSuperadmin(req);

  const [poCnt, schedCnt, fileRows] = await Promise.all([
    queryOne("SELECT COUNT(*) AS n FROM `pos`"),
    queryOne("SELECT COUNT(*) AS n FROM `po_schedules`"),
    query("SELECT `r2_key` FROM `po_files`"),
  ]);

  // Hapus foto di R2 lebih dulu (best-effort — kegagalan R2 tidak membatalkan reset data).
  let photoDeleted = 0;
  if (isR2Ready() && fileRows.length) {
    const results = await Promise.allSettled(fileRows.map((f) => deleteObject(f.r2_key)));
    photoDeleted = results.filter((r) => r.status === "fulfilled").length;
  }

  // FK ON DELETE CASCADE: po_logs, po_schedules, po_files ikut terhapus.
  await query("DELETE FROM `pos`");

  const deleted = {
    po_deleted: Number(poCnt?.n || 0),
    jadwal_deleted: Number(schedCnt?.n || 0),
    foto_deleted: photoDeleted,
  };
  await insertAudit({
    id: crypto.randomUUID(),
    user_id: current.id,
    name: current.name,
    action: "tutup_po",
    mutation_type: "po",
    mutation_id: null,
    before: { keterangan: "Tutup PO — hapus semua data PO Tracker", ...deleted },
    after: null,
    timestamp: nowIso(),
  });
  return json({ success: true, ...deleted });
});
