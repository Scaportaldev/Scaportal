import { handle, json, pageParams, paged } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { listActivity } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/logs/activity — array (lama) atau { items, total } bila ?page= dikirim. */
export const GET = handle(async (req) => {
  await requireSectionAccess(req, "logs");
  const pg = pageParams(req);
  if (!pg) return json(await listActivity(1000));
  const { items, total } = await listActivity(pg);
  return json(paged(items, total, pg));
});
