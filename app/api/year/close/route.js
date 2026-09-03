import { handle, json } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const current = await requireSectionAccess(req);
  const db = await getDb();
  const [r1, r2, r3] = await Promise.all([
    db.collection(COL.paper).deleteMany({}),
    db.collection(COL.ink).deleteMany({}),
    db.collection(COL.other).deleteMany({}),
  ]);
  await db.collection(COL.auditLogs).insertOne({
    id: crypto.randomUUID(),
    user_id: current.id,
    name: current.name,
    action: "tutup_tahun",
    mutation_type: "all",
    mutation_id: null,
    before: {
      paper_deleted: r1.deletedCount,
      ink_deleted: r2.deletedCount,
      other_deleted: r3.deletedCount,
    },
    after: null,
    timestamp: nowIso(),
  });
  return json({
    success: true,
    paper_deleted: r1.deletedCount,
    ink_deleted: r2.deletedCount,
    other_deleted: r3.deletedCount,
  });
});
