import { handle, json } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { listActivity } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSectionAccess(req, "logs");
  return json(await listActivity(1000));
});
