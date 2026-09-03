import { handle, json } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { getDb, COL, stripId } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSectionAccess(req);
  const db = await getDb();
  const docs = await db.collection(COL.auditLogs)
    .find({}).sort({ timestamp: -1 }).limit(1000).toArray();
  return json(docs.map(stripId));
});
