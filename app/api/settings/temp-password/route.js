import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin, hashPassword } from "@/server/auth";
import { setSetting } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  await requireSuperadmin(req);
  const { new_password } = await readJson(req);
  if (!new_password || String(new_password).length < 4) {
    throw new HttpError(400, "Password minimal 4 karakter");
  }
  await setSetting("temp_password", hashPassword(new_password));
  return json({ success: true });
});
