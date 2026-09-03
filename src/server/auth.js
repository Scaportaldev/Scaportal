import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getDb, COL, nowIso } from "@/server/mongo";
import { HttpError } from "@/server/http";

const ALG = "HS256";
export const TOKEN_HOURS = 12;
const encoder = new TextEncoder();

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new HttpError(500, "JWT_SECRET belum dikonfigurasi di server");
  return encoder.encode(s);
}

export function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 10);
}

export function verifyPassword(plain, hashed) {
  try {
    return bcrypt.compareSync(String(plain), String(hashed));
  } catch {
    return false;
  }
}

export async function createAccessToken({ id, username, role, sid }) {
  return await new SignJWT({ username, role, sid, type: "access" })
    .setProtectedHeader({ alg: ALG })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_HOURS}h`)
    .sign(secretKey());
}

export function setAuthCookie(res, token) {
  res.cookies.set("access_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: TOKEN_HOURS * 3600,
    path: "/",
  });
  return res;
}

export function clearAuthCookie(res) {
  res.cookies.set("access_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
    path: "/",
  });
  return res;
}

function tokenFromRequest(req) {
  const cookie = req.cookies?.get?.("access_token")?.value;
  if (cookie) return cookie;
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export async function getCurrentUser(req) {
  const token = tokenFromRequest(req);
  if (!token) throw new HttpError(401, "Belum login");

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] }));
  } catch (e) {
    if (String(e?.code) === "ERR_JWT_EXPIRED") {
      throw new HttpError(401, "Sesi berakhir, silakan login kembali");
    }
    throw new HttpError(401, "Token tidak valid");
  }
  if (payload.type !== "access") throw new HttpError(401, "Token tidak valid");

  const db = await getDb();
  const user = await db.collection(COL.users).findOne({ id: payload.sub });
  if (!user) throw new HttpError(401, "User tidak ditemukan");
  if (user.active === false) throw new HttpError(403, "User dinonaktifkan");

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active !== false,
    sid: payload.sid,
  };
}

/** Wajib superadmin. */
export async function requireSuperadmin(req) {
  const user = await getCurrentUser(req);
  if (user.role !== "superadmin") throw new HttpError(403, "Akses khusus Superadmin");
  return user;
}

/** Superadmin ATAU admin (untuk tool PO Tracker yang bisa diakses keduanya). */
export async function requireAuth(req) {
  return await getCurrentUser(req);
}

export async function verifyTempPassword(password) {
  if (!password) return false;
  const db = await getDb();
  const setting = await db.collection(COL.settings).findOne({ key: "temp_password" });
  if (!setting) return false;
  return verifyPassword(password, setting.hash);
}

/** Superadmin bebas; role lain wajib kirim header X-Section-Password yang benar. */
export async function requireSectionAccess(req) {
  const user = await getCurrentUser(req);
  if (user.role === "superadmin") return user;
  const pwd = req.headers.get("x-section-password") || "";
  if (await verifyTempPassword(pwd)) return user;
  throw new HttpError(403, "Akses section terkunci");
}

export async function logAudit(current, action, mutationType, mutationId, before, after) {
  const db = await getDb();
  await db.collection(COL.auditLogs).insertOne({
    id: crypto.randomUUID(),
    user_id: current.id,
    name: current.name,
    action,
    mutation_type: mutationType,
    mutation_id: mutationId,
    before: before || null,
    after: after || null,
    timestamp: nowIso(),
  });
}
