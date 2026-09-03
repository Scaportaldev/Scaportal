import { handle, json } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { computeStock } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "stok");
  return json(await computeStock());
});
