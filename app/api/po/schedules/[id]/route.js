import { handle, json } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const db = await getDb();
  await db.collection(COL.poSchedules).deleteOne({ id });
  return json({ ok: true });
});
