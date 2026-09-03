import { handle, json } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { computeDashboard } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const current = await requirePerm(req, "stok");
  return json(await computeDashboard(current));
});
