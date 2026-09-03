import { handle, json } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { computeDashboard } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const current = await getCurrentUser(req);
  return json(await computeDashboard(current));
});
