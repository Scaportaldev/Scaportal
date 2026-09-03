/**
 * Seed manual (opsional). API sudah auto-seed saat request pertama,
 * script ini berguna untuk menyiapkan MongoDB Atlas dari lokal:
 *
 *   cd frontend && yarn seed
 */
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// muat .env / .env.local sederhana
for (const file of [".env", ".env.local"]) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || "laporan_stok_sca";
if (!uri) {
  console.error("MONGO_URL belum diset.");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

await db.collection("users").createIndex({ username: 1 }, { unique: true });
await db.collection("paper_mutations").createIndex({ year: 1 });
await db.collection("ink_mutations").createIndex({ year: 1 });
await db.collection("other_mutations").createIndex({ year: 1 });

const suUser = process.env.SUPERADMIN_USERNAME || "Jeffsca";
const suPass = process.env.SUPERADMIN_PASSWORD || "jeff3131";
const existing = await db.collection("users").findOne({ username: suUser });
if (!existing) {
  await db.collection("users").insertOne({
    id: randomUUID(),
    name: "Jeff (Superadmin)",
    username: suUser,
    email: process.env.OWNER_EMAIL || "",
    password_hash: bcrypt.hashSync(suPass, 10),
    role: "superadmin",
    active: true,
    created_at: new Date().toISOString(),
  });
  console.log("OK: superadmin dibuat ->", suUser);
} else {
  console.log("SKIP: superadmin sudah ada ->", suUser);
}

const temp = await db.collection("settings").findOne({ key: "temp_password" });
if (!temp) {
  await db.collection("settings").insertOne({
    key: "temp_password",
    hash: bcrypt.hashSync(process.env.TEMP_ACCESS_PASSWORD || "superadminsementara", 10),
    updated_at: new Date().toISOString(),
  });
  console.log("OK: password akses sementara dibuat");
} else {
  console.log("SKIP: password akses sementara sudah ada");
}

await client.close();
console.log("Seed selesai untuk database:", dbName);
