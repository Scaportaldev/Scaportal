import { handle, json, readJson, HttpError } from "@/server/http";
import { requireSuperadmin, hashPassword } from "@/server/auth";
import { nowIso } from "@/server/db";
import { listUsers, findUserByUsername, insertUser, safeUser } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSuperadmin(req);
  const docs = await listUsers();
  return json(docs.map(safeUser));
});

export const POST = handle(async (req) => {
  await requireSuperadmin(req);
  const body = await readJson(req);
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const role = body.role;
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();

  if (!name || !username) throw new HttpError(400, "Nama dan username wajib diisi");
  if (password.length < 4) throw new HttpError(400, "Password minimal 4 karakter");
  if (!["superadmin", "admin"].includes(role)) throw new HttpError(400, "Role tidak valid");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Format email tidak valid");
  }

  const existing = await findUserByUsername(username);
  if (existing) throw new HttpError(400, "Username sudah dipakai");

  const doc = {
    id: crypto.randomUUID(),
    name,
    username,
    email,
    phone,
    password_hash: hashPassword(password),
    role,
    active: true,
    created_at: nowIso(),
  };
  await insertUser(doc);
  return json(safeUser(doc));
});
