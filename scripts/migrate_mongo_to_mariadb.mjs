#!/usr/bin/env node
/**
 * Migrasi data MongoDB (Atlas) -> MariaDB/MySQL untuk LAPORAN STOK SCA.
 *
 * Cara pakai:
 *   MONGO_URL="mongodb+srv://..." DB_NAME="laporan_stok_sca" \
 *   DATABASE_URL="mysql://user:pass@host:3306/db" \
 *   node scripts/migrate_mongo_to_mariadb.mjs [--keep]
 *
 * - Membaca .env di root repo bila ada (tanpa menimpa env yang sudah diset).
 * - Membuat tabel bila belum ada (DDL sama dengan aplikasi).
 * - Default: mengosongkan tabel tujuan dulu (idempotent). Pakai --keep untuk tidak mengosongkan.
 * - Baris yang melanggar relasi (mis. item tanpa PO) dilewati dan dilaporkan.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";

// ---------- env ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
const KEEP = process.argv.includes("--keep");
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB = process.env.DB_NAME || process.env.MONGO_DB_NAME || "laporan_stok_sca";
const DATABASE_URL = process.env.DATABASE_URL || process.env.MARIADB_URL || process.env.MYSQL_URL;
if (!MONGO_URL) { console.error("MONGO_URL belum diset"); process.exit(1); }
if (!DATABASE_URL) { console.error("DATABASE_URL belum diset"); process.exit(1); }

// ---------- DDL (disalin dari src/server/schema.js agar script mandiri) ----------
const schemaSrc = fs.readFileSync(path.join(__dirname, "..", "src", "server", "schema.js"), "utf8");
// eslint-disable-next-line no-new-func
const DDL = new Function(`${schemaSrc.replace(/export const /g, "const ").replace(/export \{[^}]*\};?/g, "")}\nreturn DDL;`)();

// ---------- helpers ----------
const iso = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dateOnly = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const num = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const str = (v, d = "") => (v === null || v === undefined ? d : String(v));
const bool = (v) => (v ? 1 : 0);
const json = (v, fallback) => JSON.stringify(v ?? fallback);
const NOW = new Date();

async function insertMany(conn, table, rows) {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  const q = (c) => "`" + c + "`";
  let n = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const sql = `INSERT INTO ${q(table)} (${cols.map(q).join(",")}) VALUES ${chunk.map(() => `(${cols.map(() => "?").join(",")})`).join(",")}`;
    const params = chunk.flatMap((r) => cols.map((c) => (r[c] === undefined ? null : r[c])));
    const [res] = await conn.query(sql, params);
    n += res.affectedRows;
  }
  return n;
}

const report = {};
const skipped = {};
const note = (table, n) => { report[table] = (report[table] || 0) + n; };
const skip = (table, why) => { skipped[table] = skipped[table] || []; skipped[table].push(why); };

// ---------- main ----------
const mongo = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 20000 });
await mongo.connect();
const mdb = mongo.db(MONGO_DB);
const col = (name) => mdb.collection(name).find({}).toArray();

const u = new URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: u.hostname, port: Number(u.port || 3306),
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1), timezone: "Z", charset: "utf8mb4_unicode_ci",
  multipleStatements: false,
});

console.log(`[migrasi] Mongo ${MONGO_DB} -> MariaDB ${u.hostname}:${u.port || 3306}/${u.pathname.slice(1)}`);
for (const sql of DDL) await conn.query(sql);

const TABLES = [
  "tempo_installments", "tempo_invoices", "tempo_top_options",
  "klien_mutations", "klien_items", "klien_pos", "klien_clients",
  "po_files", "po_schedules", "po_logs", "pos",
  "hpp_calculations", "paper_mutations", "ink_mutations", "other_mutations",
  "audit_logs", "activity_logs", "settings", "users",
];
if (!KEEP) {
  await conn.query("SET FOREIGN_KEY_CHECKS=0");
  for (const t of TABLES) await conn.query(`TRUNCATE TABLE \`${t}\``);
  await conn.query("SET FOREIGN_KEY_CHECKS=1");
  console.log("[migrasi] tabel tujuan dikosongkan");
}

// users
{
  const docs = await col("users");
  const seen = new Set();
  const rows = [];
  for (const d of docs) {
    if (!d.id || !d.username || seen.has(d.username)) { skip("users", `user tanpa id/username atau duplikat: ${d.username}`); continue; }
    seen.add(d.username);
    rows.push({
      id: d.id, name: str(d.name, d.username), username: d.username, email: str(d.email), phone: str(d.phone),
      note: d.note ?? null, password_hash: str(d.password_hash), role: d.role === "superadmin" ? "superadmin" : "admin",
      active: bool(d.active !== false), password_changed_at: iso(d.password_changed_at),
      created_at: iso(d.created_at) || NOW, updated_at: iso(d.updated_at),
    });
  }
  note("users", await insertMany(conn, "users", rows));
}

// settings & top options
{
  const docs = await col("settings");
  const rows = [];
  for (const d of docs) {
    if (d.key === "temp_password" && d.hash) rows.push({ key: "temp_password", value: d.hash, updated_at: iso(d.updated_at) || NOW });
    if (d.key === "tempo_top_options" && Array.isArray(d.values)) {
      const vals = [...new Set(d.values.map((v) => String(v).trim()).filter(Boolean))];
      note("tempo_top_options", await insertMany(conn, "tempo_top_options", vals.map((v, i) => ({ value: v, sort_order: i }))));
    }
  }
  note("settings", await insertMany(conn, "settings", rows));
}

// activity & audit
{
  const act = (await col("activity_logs")).filter((d) => d.id).map((d) => ({
    id: d.id, user_id: d.user_id ?? null, name: d.name ?? null, username: d.username ?? null,
    login_time: iso(d.login_time) || NOW, logout_time: iso(d.logout_time), logout_type: d.logout_type ?? null,
  }));
  note("activity_logs", await insertMany(conn, "activity_logs", act));
  const aud = (await col("audit_logs")).filter((d) => d.id).map((d) => ({
    id: d.id, user_id: d.user_id ?? null, name: d.name ?? null, action: str(d.action, "-"),
    mutation_type: d.mutation_type ?? null, mutation_id: d.mutation_id ?? null,
    before_data: d.before ? json(d.before) : null, after_data: d.after ? json(d.after) : null,
    timestamp: iso(d.timestamp) || NOW,
  }));
  note("audit_logs", await insertMany(conn, "audit_logs", aud));
}

// mutasi stok
{
  const base = (d) => {
    const date = dateOnly(d.date);
    if (!d.id || !date) return null;
    const trx = ["masuk", "keluar", "retur"].includes(d.jenis_transaksi) ? d.jenis_transaksi : "masuk";
    return {
      id: d.id, date, year: num(d.year, Number(date.slice(0, 4))), kode: str(d.kode), jenis_transaksi: trx,
      jumlah: num(d.jumlah), supplier: str(d.supplier), pic_name: str(d.pic_name),
      ppn_ada: bool(d.ppn_ada), ppn_nominal: num(d.ppn_nominal), ref_mutation_id: d.ref_mutation_id ?? null,
      created_by: d.created_by ?? null, created_by_name: d.created_by_name ?? null,
      created_at: iso(d.created_at) || NOW, updated_at: iso(d.updated_at),
    };
  };
  const paper = [];
  for (const d of await col("paper_mutations")) {
    const b = base(d); if (!b) { skip("paper_mutations", `id/tanggal tidak valid (${d.id})`); continue; }
    const mode = ["per_rim", "per_kg", "total"].includes(d.price_mode) ? d.price_mode : (d.jenis_transaksi === "masuk" ? "per_rim" : null);
    paper.push({ ...b, jenis_kertas: str(d.jenis_kertas, "-"), gramatur: num(d.gramatur), panjang: num(d.panjang), lebar: num(d.lebar),
      price_mode: mode, price_input: d.price_input === null || d.price_input === undefined ? null : num(d.price_input), harga_per_rim: num(d.harga_per_rim) });
  }
  note("paper_mutations", await insertMany(conn, "paper_mutations", paper));

  const ink = [];
  for (const d of await col("ink_mutations")) {
    const b = base(d); if (!b) { skip("ink_mutations", `id/tanggal tidak valid (${d.id})`); continue; }
    ink.push({ ...b, jenis_tinta: str(d.jenis_tinta, "-"), harga_per_kg: num(d.harga_per_kg) });
  }
  note("ink_mutations", await insertMany(conn, "ink_mutations", ink));

  const other = [];
  for (const d of await col("other_mutations")) {
    const b = base(d); if (!b) { skip("other_mutations", `id/tanggal tidak valid (${d.id})`); continue; }
    other.push({ ...b, nama_barang: str(d.nama_barang, "-"), satuan: str(d.satuan), harga_per_satuan: num(d.harga_per_satuan) });
  }
  note("other_mutations", await insertMany(conn, "other_mutations", other));
}

// HPP
{
  const rows = (await col("hpp_calculations")).filter((d) => d.id).map((d) => ({
    id: d.id, name: str(d.name, "HPP"), customer: str(d.customer), notes: str(d.notes),
    inputs: json(d.inputs, {}), result: json(d.result, {}), owner_id: d.owner_id ?? null, owner_name: d.owner_name ?? null,
    created_at: iso(d.created_at) || NOW, updated_at: iso(d.updated_at) || iso(d.created_at) || NOW,
  }));
  note("hpp_calculations", await insertMany(conn, "hpp_calculations", rows));
}

// PO Tracker
{
  const docs = await col("pos");
  const poIds = new Set();
  const seenNum = new Set();
  const rows = [];
  const logs = [];
  for (const d of docs) {
    if (!d.id || !d.po_number) { skip("pos", `PO tanpa id/nomor (${d.id})`); continue; }
    if (seenNum.has(d.po_number)) { skip("pos", `nomor PO duplikat: ${d.po_number}`); continue; }
    seenNum.add(d.po_number); poIds.add(d.id);
    rows.push({
      id: d.id, po_number: str(d.po_number), client_name: str(d.client_name, "-"), item_type: str(d.item_type),
      material: str(d.material), paper_size: str(d.paper_size), quantity: str(d.quantity),
      po_date: dateOnly(d.po_date), est_start: dateOnly(d.est_start), est_end: dateOnly(d.est_end),
      print_machine: d.print_machine ?? null,
      enabled_stages: json(Array.isArray(d.enabled_stages) ? d.enabled_stages.map(Number) : [], []),
      stage_data: json(d.stage_data && typeof d.stage_data === "object" ? d.stage_data : {}, {}),
      notes: str(d.notes), created_by: d.created_by ?? null, created_by_username: d.created_by_username ?? null,
      created_at: iso(d.created_at) || NOW, updated_at: iso(d.updated_at) || iso(d.created_at) || NOW,
    });
    for (const l of d.logs || []) {
      logs.push({ po_id: d.id, timestamp: iso(l.timestamp) || NOW, message: str(l.message), user_name: l.user ?? null });
    }
  }
  note("pos", await insertMany(conn, "pos", rows));
  note("po_logs", await insertMany(conn, "po_logs", logs));

  const sched = [];
  for (const d of await col("po_schedules")) {
    const date = dateOnly(d.date);
    if (!d.id || !poIds.has(d.po_id) || !date) { skip("po_schedules", `jadwal tanpa PO/tanggal valid (${d.id})`); continue; }
    sched.push({ id: d.id, po_id: d.po_id, po_number: str(d.po_number), client_name: str(d.client_name), stage_number: num(d.stage_number, 1),
      stage_name: str(d.stage_name), date, note: str(d.note), created_at: iso(d.created_at) || NOW });
  }
  note("po_schedules", await insertMany(conn, "po_schedules", sched));

  const files = [];
  for (const d of await col("po_files")) {
    if (!d.id || !poIds.has(d.po_id)) { skip("po_files", `file tanpa PO (${d.id})`); continue; }
    files.push({ id: d.id, po_id: d.po_id, stage_number: num(d.stage_number, 1), r2_key: str(d.r2_key), public_url: d.public_url ?? null,
      original_filename: str(d.original_filename), content_type: str(d.content_type, "application/octet-stream"), size: num(d.size),
      is_deleted: bool(d.is_deleted), uploaded_by: d.uploaded_by ?? null, created_at: iso(d.created_at) || NOW, deleted_at: iso(d.deleted_at) });
  }
  note("po_files", await insertMany(conn, "po_files", files));
}

// Stok Klien
{
  const kliens = await col("klien_clients");
  const kIds = new Set();
  const seenNama = new Set();
  const kRows = [];
  for (const d of kliens) {
    const nama = str(d.nama).trim();
    if (!d.id || !nama || seenNama.has(nama.toLowerCase())) { skip("klien_clients", `klien tanpa id/nama atau duplikat (${d.nama})`); continue; }
    seenNama.add(nama.toLowerCase()); kIds.add(d.id);
    kRows.push({ id: d.id, nama, created_at: iso(d.created_at) || NOW });
  }
  note("klien_clients", await insertMany(conn, "klien_clients", kRows));

  const pIds = new Set();
  const seenPo = new Set();
  const pRows = [];
  for (const d of await col("klien_pos")) {
    const key = `${d.klien_id}|${d.no_po}`;
    if (!d.id || !kIds.has(d.klien_id) || !d.no_po || seenPo.has(key)) { skip("klien_pos", `PO tanpa klien/no_po atau duplikat (${d.no_po})`); continue; }
    seenPo.add(key); pIds.add(d.id);
    pRows.push({ id: d.id, klien_id: d.klien_id, no_po: str(d.no_po), tanggal_po: dateOnly(d.tanggal_po) || dateOnly(d.created_at) || dateOnly(NOW), created_at: iso(d.created_at) || NOW });
  }
  note("klien_pos", await insertMany(conn, "klien_pos", pRows));

  const iIds = new Set();
  const iRows = [];
  for (const d of await col("klien_items")) {
    if (!d.id || !pIds.has(d.po_id)) { skip("klien_items", `item tanpa PO (${d.id})`); continue; }
    iIds.add(d.id);
    iRows.push({ id: d.id, po_id: d.po_id, jenis_item: str(d.jenis_item, "-"), satuan: str(d.satuan), kuantiti: num(d.kuantiti),
      keterangan: str(d.keterangan), status: d.status === "selesai" ? "selesai" : "aktif", created_at: iso(d.created_at) || NOW });
  }
  note("klien_items", await insertMany(conn, "klien_items", iRows));

  const mRows = [];
  for (const d of await col("klien_mutations")) {
    if (!d.id || !iIds.has(d.item_id)) { skip("klien_mutations", `mutasi tanpa item (${d.id})`); continue; }
    mRows.push({ id: d.id, item_id: d.item_id, po_id: d.po_id, klien_id: d.klien_id ?? null, jenis: d.jenis === "keluar" ? "keluar" : "masuk",
      jumlah: num(d.jumlah), tanggal: iso(d.tanggal) || iso(d.created_at) || NOW, keterangan: str(d.keterangan), pic_name: d.pic_name ?? null,
      created_at: iso(d.created_at) || NOW });
  }
  note("klien_mutations", await insertMany(conn, "klien_mutations", mRows));
}

// Jatuh Tempo
{
  const rows = [];
  const inst = [];
  for (const d of await col("tempo_invoices")) {
    if (!d.id) { skip("tempo_invoices", "invoice tanpa id"); continue; }
    rows.push({ id: d.id, client_name: str(d.client_name, "-"), top: str(d.top, "Cash"), po_date: dateOnly(d.po_date), po_number: d.po_number ?? null,
      delivery_note_number: d.delivery_note_number ?? null, invoice_number: d.invoice_number ?? null, invoice_date: dateOnly(d.invoice_date),
      total_amount: num(d.total_amount), due_date: dateOnly(d.due_date), status: d.status === "lunas" ? "lunas" : "belum_lunas",
      created_at: iso(d.created_at) || NOW, updated_at: iso(d.updated_at) || iso(d.created_at) || NOW });
    (d.installments || []).forEach((i, idx) => inst.push({ id: i.id || crypto.randomUUID(), invoice_id: d.id, sequence: num(i.sequence, idx + 1), amount: num(i.amount), date: dateOnly(i.date) }));
  }
  note("tempo_invoices", await insertMany(conn, "tempo_invoices", rows));
  note("tempo_installments", await insertMany(conn, "tempo_installments", inst));
}

await conn.end();
await mongo.close();

console.log("\n[migrasi] SELESAI. Baris tersalin per tabel:");
for (const [t, n] of Object.entries(report)) console.log(`  ${t.padEnd(22)} ${n}`);
const skippedTotal = Object.values(skipped).reduce((s, a) => s + a.length, 0);
if (skippedTotal) {
  console.log(`\n[migrasi] ${skippedTotal} baris dilewati:`);
  for (const [t, arr] of Object.entries(skipped)) console.log(`  ${t}: ${arr.length}  (mis. ${arr[0]})`);
}
