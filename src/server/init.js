/**
 * Inisialisasi database: buat tabel (idempotent) + seed data awal.
 * Dipanggil sekali per proses lewat ensureInit() di wrapper handle().
 */
import { query, nowIso } from "@/server/db";
import { DDL } from "@/server/schema";
import { hashPassword, verifyPassword } from "@/server/auth";
import { findUserByUsername, insertUser, updateUser } from "@/server/users";
import { getSetting, setSetting } from "@/server/settings";
import { ensureTopSeed } from "@/server/tempo";

const g = globalThis;

async function runInit() {
  for (const sql of DDL) {
    await query(sql);
  }

  // Seed superadmin (idempotent) + sinkronkan password dari env
  const suUser = process.env.SUPERADMIN_USERNAME || "Jeffsca";
  const suPass = process.env.SUPERADMIN_PASSWORD || "jeff3131";
  const existing = await findUserByUsername(suUser);
  if (!existing) {
    await insertUser({
      id: crypto.randomUUID(),
      name: "Jeff (Superadmin)",
      username: suUser,
      email: process.env.OWNER_EMAIL || "",
      phone: "",
      password_hash: hashPassword(suPass),
      role: "superadmin",
      active: true,
      created_at: nowIso(),
    });
    console.log("[init] seeded superadmin", suUser);
  } else if (!verifyPassword(suPass, existing.password_hash)) {
    await updateUser(existing.id, { password_hash: hashPassword(suPass) });
    console.log("[init] superadmin password disinkronkan dari env");
  }

  // Seed password akses sementara (idempotent)
  const temp = await getSetting("temp_password");
  if (!temp) {
    await setSetting("temp_password", hashPassword(process.env.TEMP_ACCESS_PASSWORD || "superadminsementara"));
    console.log("[init] seeded temp access password");
  }

  // Seed opsi TOP Jatuh Tempo Klien
  await ensureTopSeed();
}

export function ensureInit() {
  if (!g.__scaInit) {
    g.__scaInit = runInit().catch((e) => {
      g.__scaInit = null;
      throw e;
    });
  }
  return g.__scaInit;
}
