import { handle, json } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { computeStock } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await getCurrentUser(req);
  return json(await computeStock());
});
