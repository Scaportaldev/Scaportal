import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin, hashPassword } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  await requireSuperadmin(req);
  const { new_password } = await readJson(req);
  if (!new_password || String(new_password).length < 4) {
    throw new HttpError(400, "Password minimal 4 karakter");
  }
  const db = await getDb();
  await db.collection(COL.settings).updateOne(
    { key: "temp_password" },
    { $set: { hash: hashPassword(new_password), updated_at: nowIso() } },
    { upsert: true },
  );
  return json({ success: true });
});
