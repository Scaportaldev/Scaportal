import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin, hashPassword, logAudit } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  const current = await requireSuperadmin(req);
  const { id } = await params;
  const db = await getDb();
  const user = await db.collection(COL.users).findOne({ id });
  if (!user) throw new HttpError(404, "User tidak ditemukan");
  if (user.id === current.id) throw new HttpError(400, "Tidak bisa menghapus diri sendiri");
  await db.collection(COL.users).deleteOne({ id });
  return json({ success: true });
});

/**
 * Ubah data user (khusus Superadmin): nama, username, email (opsional),
 * telepon/catatan (opsional), role, dan password baru (opsional).
 * Superadmin juga boleh mengubah akunnya sendiri, kecuali menurunkan
 * role-nya sendiri agar tidak terkunci dari sistem.
 */
export const PATCH = handle(async (req, { params }) => {
  const current = await requireSuperadmin(req);
  const { id } = await params;
  const body = await readJson(req);

  const db = await getDb();
  const user = await db.collection(COL.users).findOne({ id });
  if (!user) throw new HttpError(404, "User tidak ditemukan");

  const set = {};

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) throw new HttpError(400, "Nama wajib diisi");
    set.name = name;
  }

  if (body.username !== undefined) {
    const username = String(body.username || "").trim();
    if (!username) throw new HttpError(400, "Username wajib diisi");
    if (username !== user.username) {
      const dup = await db.collection(COL.users).findOne({ username });
      if (dup) throw new HttpError(400, "Username sudah dipakai");
      set.username = username;
    }
  }

  if (body.email !== undefined) {
    const email = String(body.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "Format email tidak valid");
    }
    set.email = email;
  }

  if (body.phone !== undefined) set.phone = String(body.phone || "").trim();
  if (body.note !== undefined) set.note = String(body.note || "").trim();

  if (body.role !== undefined && body.role !== user.role) {
    if (!["superadmin", "admin"].includes(body.role)) throw new HttpError(400, "Role tidak valid");
    if (user.id === current.id) throw new HttpError(400, "Tidak bisa mengubah role akun sendiri");
    set.role = body.role;
  }

  if (body.new_password) {
    const newPassword = String(body.new_password);
    if (newPassword.length < 4) throw new HttpError(400, "Password minimal 4 karakter");
    set.password_hash = hashPassword(newPassword);
    set.password_changed_at = nowIso();
  }

  if (!Object.keys(set).length) throw new HttpError(400, "Tidak ada perubahan");

  set.updated_at = nowIso();
  await db.collection(COL.users).updateOne({ id }, { $set: set });
  const fresh = await db.collection(COL.users).findOne({ id });

  try {
    await logAudit(
      current,
      "ubah_data_user",
      "user",
      id,
      { name: user.name, username: user.username, email: user.email || "", role: user.role },
      {
        name: fresh.name,
        username: fresh.username,
        email: fresh.email || "",
        role: fresh.role,
        password_diubah: !!body.new_password,
      },
    );
  } catch { /* audit gagal tidak menggagalkan aksi utama */ }

  const { password_hash, _id, ...safe } = fresh;
  return json({ success: true, user: safe, self: user.id === current.id });
});
