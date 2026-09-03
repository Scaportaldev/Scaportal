import { handle, json, readJson, HttpError } from "@/server/http";
import { getCurrentUser, verifyTempPassword } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const current = await getCurrentUser(req);
  if (current.role === "superadmin") return json({ valid: true });
  const { password } = await readJson(req);
  if (!(await verifyTempPassword(password))) throw new HttpError(403, "Password akses salah");
  return json({ valid: true });
});
