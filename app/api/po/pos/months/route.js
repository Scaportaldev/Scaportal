import { handle, json } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { listPoMonths } from "@/server/po/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/po/pos/months -> ['2026-09', '2026-08', ...] untuk dropdown filter bulan. */
export const GET = handle(async (req) => {
  await requirePerm(req, "po");
  return json(await listPoMonths());
});
