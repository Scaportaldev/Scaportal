import { handle, json } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { listAudit } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSectionAccess(req, "logs");
  return json(await listAudit(1000));
});
