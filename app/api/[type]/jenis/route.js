import { handle, json } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { distinctNames } from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await getCurrentUser(req);
  const { type } = await params;
  const vals = await distinctNames(type);
  return json(vals.sort((a, b) => String(a).localeCompare(String(b))));
});
