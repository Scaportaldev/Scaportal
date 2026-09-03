import { handle, json } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { deleteSchedule } from "@/server/po/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  await deleteSchedule(id);
  return json({ ok: true });
});
