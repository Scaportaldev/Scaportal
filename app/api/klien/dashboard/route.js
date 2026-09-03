import { handle, json } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { loadTree } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "klien");
  const { summary, kliens } = await loadTree();
  return json({ summary, kliens });
});
