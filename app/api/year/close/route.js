import { handle, json } from "@/server/http";
import { requireSectionAccess } from "@/server/auth";
import { nowIso } from "@/server/db";
import { deleteAllMutations } from "@/server/mutations";
import { insertAudit } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const current = await requireSectionAccess(req, "stok_tutup_tahun");
  const [r1, r2, r3] = await Promise.all([
    deleteAllMutations("paper"),
    deleteAllMutations("ink"),
    deleteAllMutations("other"),
  ]);
  await insertAudit({
    id: crypto.randomUUID(),
    user_id: current.id,
    name: current.name,
    action: "tutup_tahun",
    mutation_type: "all",
    mutation_id: null,
    before: { paper_deleted: r1, ink_deleted: r2, other_deleted: r3 },
    after: null,
    timestamp: nowIso(),
  });
  return json({
    success: true,
    paper_deleted: r1,
    ink_deleted: r2,
    other_deleted: r3,
  });
});
