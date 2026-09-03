import { handle, json, readJson } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { listPos } from "@/server/po/repo";
import { computeStatus, rangesOverlap } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  await requirePerm(req, "po");
  const body = await readJson(req);
  const estStart = body.est_start;
  const estEnd = body.est_end;
  const excludeId = body.exclude_id || null;
  if (!estStart || !estEnd) return json({ conflicts: [] });

  const docs = await listPos({ limit: 100000 });
  const conflicts = [];
  for (const po of docs) {
    if (excludeId && po.id === excludeId) continue;
    if (computeStatus(po).is_completed) continue;
    if (rangesOverlap(estStart, estEnd, po.est_start, po.est_end)) {
      conflicts.push({
        id: po.id, po_number: po.po_number, client_name: po.client_name,
        est_start: po.est_start, est_end: po.est_end, print_machine: po.print_machine,
      });
    }
  }
  return json({ conflicts });
});
