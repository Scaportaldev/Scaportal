import { handle, json } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { computeStatus } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const db = await getDb();
  const pos = await db.collection(COL.pos).find({}).toArray();
  const counts = {
    waiting_1: 0, waiting_2: 0, waiting_3: 0,
    stage_4: 0, stage_5: 0, stage_6: 0, stage_7: 0, stage_8: 0, stage_9: 0, stage_10: 0,
    printing: 0, print_done_not_shipped: 0, shipped: 0, delivery_failed: 0, no_stages: 0,
  };
  let active = 0;
  let completed = 0;
  for (const po of pos) {
    const c = computeStatus(po);
    if (c.bucket === "completed") {
      completed++;
      if ((po.enabled_stages || []).includes(11)) counts.shipped++;
    } else {
      active++;
      if (counts[c.bucket] !== undefined) counts[c.bucket]++;
    }
  }
  return json({
    counts,
    total_active: active,
    total_completed: completed,
    total: pos.length,
  });
});
