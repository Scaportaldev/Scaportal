import { handle, json } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { query, queryOne, nowIso } from "@/server/db";
import { insertAudit } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/klien/close — "Tutup Stok Klien" (khusus Superadmin).
 * Konsep seperti Tutup Tahun: frontend mewajibkan unduh PDF laporan dulu,
 * lalu endpoint ini menghapus SEMUA data Stok Klien:
 * klien_clients (+ klien_pos, klien_items, klien_mutations via FK CASCADE).
 */
export const POST = handle(async (req) => {
  const current = await requireSuperadmin(req);

  const [klienCnt, poCnt, itemCnt, mutCnt] = await Promise.all([
    queryOne("SELECT COUNT(*) AS n FROM `klien_clients`"),
    queryOne("SELECT COUNT(*) AS n FROM `klien_pos`"),
    queryOne("SELECT COUNT(*) AS n FROM `klien_items`"),
    queryOne("SELECT COUNT(*) AS n FROM `klien_mutations`"),
  ]);

  // FK ON DELETE CASCADE: klien_pos -> klien_items -> klien_mutations ikut terhapus.
  await query("DELETE FROM `klien_clients`");

  const deleted = {
    klien_deleted: Number(klienCnt?.n || 0),
    po_deleted: Number(poCnt?.n || 0),
    item_deleted: Number(itemCnt?.n || 0),
    mutasi_deleted: Number(mutCnt?.n || 0),
  };
  await insertAudit({
    id: crypto.randomUUID(),
    user_id: current.id,
    name: current.name,
    action: "tutup_klien",
    mutation_type: "klien",
    mutation_id: null,
    before: { keterangan: "Tutup Stok Klien — hapus semua data stok klien", ...deleted },
    after: null,
    timestamp: nowIso(),
  });
  return json({ success: true, ...deleted });
});
