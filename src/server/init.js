import { getDb, COL, nowIso } from "@/server/mongo";
import { hashPassword, verifyPassword } from "@/server/auth";

const g = globalThis;

async function runInit() {
  const db = await getDb();

  await Promise.all([
    db.collection(COL.users).createIndex({ username: 1 }, { unique: true }),
    db.collection(COL.paper).createIndex({ year: 1 }),
    db.collection(COL.ink).createIndex({ year: 1 }),
    db.collection(COL.other).createIndex({ year: 1 }),
    db.collection(COL.activityLogs).createIndex({ login_time: -1 }),
    db.collection(COL.auditLogs).createIndex({ timestamp: -1 }),
    // HPP
    db.collection(COL.hppCalcs).createIndex({ updated_at: -1 }),
    db.collection(COL.hppCalcs).createIndex({ id: 1 }, { unique: true }),
    // PO Tracker
    db.collection(COL.pos).createIndex({ po_number: 1 }, { unique: true }),
    db.collection(COL.pos).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.pos).createIndex({ created_at: -1 }),
    db.collection(COL.poSchedules).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.poSchedules).createIndex({ date: 1 }),
    db.collection(COL.poSchedules).createIndex({ po_id: 1 }),
    db.collection(COL.poFiles).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.poFiles).createIndex({ po_id: 1, is_deleted: 1 }),
    // Stok Klien
    db.collection(COL.klienClients).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.klienClients).createIndex({ nama: 1 }),
    db.collection(COL.klienPos).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.klienPos).createIndex({ klien_id: 1 }),
    db.collection(COL.klienItems).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.klienItems).createIndex({ po_id: 1 }),
    db.collection(COL.klienMutations).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.klienMutations).createIndex({ item_id: 1 }),
    db.collection(COL.klienMutations).createIndex({ tanggal: -1 }),
    // Jatuh Tempo Klien
    db.collection(COL.tempoInvoices).createIndex({ id: 1 }, { unique: true }),
    db.collection(COL.tempoInvoices).createIndex({ due_date: 1 }),
    db.collection(COL.tempoInvoices).createIndex({ status: 1 }),
  ]);

  // Seed superadmin (idempotent)
  const suUser = process.env.SUPERADMIN_USERNAME || "Jeffsca";
  const suPass = process.env.SUPERADMIN_PASSWORD || "jeff3131";
  const existing = await db.collection(COL.users).findOne({ username: suUser });
  if (!existing) {
    await db.collection(COL.users).insertOne({
      id: crypto.randomUUID(),
      name: "Jeff (Superadmin)",
      username: suUser,
      email: process.env.OWNER_EMAIL || "",
      password_hash: hashPassword(suPass),
      role: "superadmin",
      active: true,
      created_at: nowIso(),
    });
    console.log("[init] seeded superadmin", suUser);
  } else if (!verifyPassword(suPass, existing.password_hash)) {
    await db
      .collection(COL.users)
      .updateOne({ username: suUser }, { $set: { password_hash: hashPassword(suPass) } });
    console.log("[init] superadmin password disinkronkan dari env");
  }

  // Seed temp access password (idempotent)
  const temp = await db.collection(COL.settings).findOne({ key: "temp_password" });
  if (!temp) {
    await db.collection(COL.settings).insertOne({
      key: "temp_password",
      hash: hashPassword(process.env.TEMP_ACCESS_PASSWORD || "superadminsementara"),
      updated_at: nowIso(),
    });
    console.log("[init] seeded temp access password");
  }
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
