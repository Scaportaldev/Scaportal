import { NextResponse } from "next/server";
import { handle, readJson, HttpError } from "@/server/http";
import { nowIso } from "@/server/db";
import { verifyPassword, createAccessToken, setAuthCookie } from "@/server/auth";
import { findUserByUsername } from "@/server/users";
import { insertActivity } from "@/server/logs";
import { effectivePermissions } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Login hanya dengan username + password. Role tidak lagi dipilih di form —
 * role & hak akses (permissions) ditentukan dari data user di database.
 */
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) throw new HttpError(400, "Username dan password wajib diisi");

  const user = await findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, "Username atau password salah");
  }
  if (user.active === false) throw new HttpError(403, "User dinonaktifkan");

  const sid = crypto.randomUUID();
  await insertActivity({
    id: sid,
    user_id: user.id,
    name: user.name,
    username: user.username,
    login_time: nowIso(),
  });

  const token = await createAccessToken({
    id: user.id, username: user.username, role: user.role, sid,
  });

  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email || "",
    phone: user.phone || "",
    role: user.role,
    permissions: effectivePermissions(user),
    token,
  });
  return setAuthCookie(res, token);
});
