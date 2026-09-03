import { handle, json, readJson } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { listPosOverlapping } from "@/server/po/repo";
import { computeStatus } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cek bentrok jadwal produksi. Irisan rentang tanggal disaring di SQL
 * (bukan memuat seluruh PO), lalu PO yang sudah selesai dikecualikan di JS.
 */
export const POST = handle(async (req) => {
  await requirePerm(req, "po");
  const body = await readJson(req);
  const estStart = body.est_start;
  const estEnd = body.est_end;
  const excludeId = body.exclude_id || null;
  if (!estStart || !estEnd) return json({ conflicts: [] });

  const docs = await listPosOverlapping(estStart, estEnd, excludeId);
  const conflicts = [];
  for (const po of docs) {
    if (computeStatus(po).is_completed) continue;
    conflicts.push({
      id: po.id, po_number: po.po_number, client_name: po.client_name,
      est_start: po.est_start, est_end: po.est_end, print_machine: po.print_machine,
    });
  }
  return json({ conflicts });
});
