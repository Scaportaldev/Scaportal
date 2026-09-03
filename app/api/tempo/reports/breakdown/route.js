import { handle, json, qp } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { computeBreakdown } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSuperadmin(req);
  return json(await computeBreakdown(qp(req, "start"), qp(req, "end")));
});
