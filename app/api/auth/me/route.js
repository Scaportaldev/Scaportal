import { handle, json, readJson, HttpError } from "@/server/http";
import { getCurrentUser, hashPassword, verifyPassword, logAudit } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const u = await getCurrentUser(req);
  return json({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email || "",
    phone: u.phone || "",
    role: u.role,
  });
});

/**
 * Ubah profil akun sendiri (semua role).
 * - Nama & email boleh diubah langsung.
 * - Ganti password wajib menyertakan password lama.
 */
export const PATCH = handle(async (req) => {
  const current = await getCurrentUser(req);
  const body = await readJson(req);

  const set = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) throw new HttpError(400, "Nama tidak boleh kosong");
    set.name = name;
  }
  if (body.email !== undefined) {
    const email = String(body.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "Format email tidak valid");
    }
    set.email = email;
  }
  if (body.phone !== undefined) set.phone = String(body.phone || "").trim();

  const newPassword = String(body.new_password || "");
  if (newPassword) {
    const currentPassword = String(body.current_password || "");
    if (!currentPassword) throw new HttpError(400, "Password lama wajib diisi");
    const db0 = await getDb();
    const doc = await db0.collection(COL.users).findOne({ id: current.id });
    if (!verifyPassword(currentPassword, doc?.password_hash || "")) {
      throw new HttpError(400, "Password lama salah");
    }
    if (newPassword.length < 4) throw new HttpError(400, "Password baru minimal 4 karakter");
    set.password_hash = hashPassword(newPassword);
    set.password_changed_at = nowIso();
  }

  if (!Object.keys(set).length) throw new HttpError(400, "Tidak ada perubahan");

  const db = await getDb();
  await db.collection(COL.users).updateOne({ id: current.id }, { $set: set });
  const fresh = await db.collection(COL.users).findOne({ id: current.id });

  try {
    await logAudit(current, "ubah_profil_sendiri", "user", current.id, null, {
      fields: Object.keys(set).map((k) => (k === "password_hash" ? "password" : k)),
    });
  } catch { /* audit gagal tidak menggagalkan aksi utama */ }

  return json({
    success: true,
    user: {
      id: fresh.id,
      name: fresh.name,
      username: fresh.username,
      email: fresh.email || "",
      phone: fresh.phone || "",
      role: fresh.role,
    },
  });
});
