import { handle, json } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { loadTree } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const { summary, kliens } = await loadTree();
  return json({ summary, kliens });
});
