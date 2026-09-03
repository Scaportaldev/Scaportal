import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin, hashPassword, logAudit } from "@/server/auth";
import { nowIso } from "@/server/db";
import { findUserById, updateUser } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ganti password user (khusus Superadmin).
 * Superadmin boleh mengganti password user mana pun, termasuk akunnya sendiri.
 */
export const PATCH = handle(async (req, { params }) => {
  const current = await requireSuperadmin(req);
  const { id } = await params;
  const body = await readJson(req);
  const newPassword = String(body.new_password || "");

  if (newPassword.length < 4) throw new HttpError(400, "Password minimal 4 karakter");

  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "User tidak ditemukan");

  await updateUser(id, { password_hash: hashPassword(newPassword), password_changed_at: nowIso() });

  // Catat di audit log tanpa pernah menyimpan nilai password.
  try {
    await logAudit(current, "ubah_password_user", "user", id, null, {
      username: user.username,
      self: user.id === current.id,
    });
  } catch { /* audit gagal tidak boleh menggagalkan aksi utama */ }

  return json({
    success: true,
    self: user.id === current.id,
    username: user.username,
  });
});
