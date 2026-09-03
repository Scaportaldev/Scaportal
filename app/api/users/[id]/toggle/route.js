import { handle, json, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { findUserById, updateUser } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handle(async (req, { params }) => {
  const current = await requireSuperadmin(req);
  const { id } = await params;
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "User tidak ditemukan");
  if (user.id === current.id) throw new HttpError(400, "Tidak bisa menonaktifkan diri sendiri");
  const next = !(user.active !== false);
  await updateUser(id, { active: next });
  return json({ success: true, active: next });
});
