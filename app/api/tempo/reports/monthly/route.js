import { handle, json, qp } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { computeMonthly } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "tempo");
  return json(await computeMonthly(qp(req, "year")));
});
