/**
 * Validasi deploy/dummy_data.sql tanpa perlu mengimpor
 * (user `mariadb` tidak punya grant CREATE DATABASE, jadi DB uji tidak bisa dibuat).
 *
 * Tiga lapis pemeriksaan:
 *  1. Struktur: jumlah CREATE TABLE, DROP TABLE, LOCK/UNLOCK berpasangan.
 *  2. Konsistensi: jumlah kolom pada tiap tuple VALUES == jumlah kolom di INSERT,
 *     dan jumlah baris per tabel == jumlah baris nyata di database.
 *  3. Escaping: literal SQL hasil generator dikirim balik ke MariaDB lewat
 *     SELECT lalu dibandingkan dengan nilai aslinya. Ini menguji bagian paling
 *     rawan (kutip, backslash, newline, blob JSON) dengan parser MariaDB sungguhan.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { getDbConfig } from "./_dbconfig.mjs";

const FILE = "/app/deploy/dummy_data.sql";
const sql = readFileSync(FILE, "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  GAGAL ${name} — ${detail}`); }
};

const conn = await mysql.createConnection({ ...getDbConfig(), dateStrings: true });

// ── 1. Struktur ────────────────────────────────────────────────────────────
console.log("\n1) Struktur file");
const creates = [...sql.matchAll(/CREATE TABLE `([a-z_]+)`/g)].map((m) => m[1]);
const drops = [...sql.matchAll(/DROP TABLE IF EXISTS `([a-z_]+)`/g)].map((m) => m[1]);
const locks = (sql.match(/^LOCK TABLES /gm) || []).length;
const unlocks = (sql.match(/^UNLOCK TABLES;/gm) || []).length;

const [tRaw] = await conn.query("SHOW TABLES");
const dbTables = tRaw.map((r) => Object.values(r)[0]).sort();

ok(`CREATE TABLE = jumlah tabel database (${creates.length})`, creates.length === dbTables.length, `file=${creates.length} db=${dbTables.length}`);
ok("setiap CREATE punya DROP TABLE IF EXISTS", creates.length === drops.length, `create=${creates.length} drop=${drops.length}`);
ok(`LOCK/UNLOCK berpasangan (${locks})`, locks === unlocks && locks === creates.length, `lock=${locks} unlock=${unlocks}`);
ok("semua tabel database ada di file", JSON.stringify([...creates].sort()) === JSON.stringify(dbTables),
  `hilang=${dbTables.filter((t) => !creates.includes(t)).join(",") || "-"}`);
ok("header & footer transaksi lengkap", sql.includes("SET NAMES utf8mb4") && sql.includes("Dump completed on"));
ok("FOREIGN_KEY_CHECKS dimatikan saat impor", sql.includes("FOREIGN_KEY_CHECKS=0"));

// ── 2. Konsistensi jumlah kolom & baris ───────────────────────────────────
console.log("\n2) Konsistensi INSERT");
// Pecah per statement INSERT
const insertRe = /INSERT INTO `([a-z_]+)` \(([^)]+)\) VALUES\n([\s\S]*?);\n/g;
const rowCount = {};
let badTuple = 0, stmtCount = 0;

/** Pecah daftar tuple "(...),(...)" dengan menghormati string ber-kutip. */
function splitTuples(text) {
  const tuples = [];
  let depth = 0, inStr = false, esc = false, cur = "";
  for (const ch of text) {
    if (inStr) {
      cur += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "'") inStr = false;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === "(") { depth++; if (depth === 1) { cur = ""; continue; } }
    if (ch === ")") { depth--; if (depth === 0) { tuples.push(cur); continue; } }
    if (depth > 0) cur += ch;
  }
  return tuples;
}

/** Pecah satu tuple jadi daftar literal, menghormati kutip. */
function splitFields(tuple) {
  const out = [];
  let inStr = false, esc = false, cur = "";
  for (const ch of tuple) {
    if (inStr) {
      cur += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "'") inStr = false;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === ",") { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

let m;
while ((m = insertRe.exec(sql)) !== null) {
  stmtCount++;
  const table = m[1];
  const nCols = m[2].split(",").length;
  const tuples = splitTuples(m[3]);
  rowCount[table] = (rowCount[table] || 0) + tuples.length;
  for (const t of tuples) {
    if (splitFields(t).length !== nCols) { badTuple++; if (badTuple <= 3) console.log(`     tuple ganjil di ${table}`); }
  }
}
ok(`semua tuple jumlah kolomnya cocok (${stmtCount} statement INSERT)`, badTuple === 0, `ganjil=${badTuple}`);

let mismatch = [];
for (const t of dbTables) {
  const [[r]] = await conn.query(`SELECT COUNT(*) c FROM \`${t}\``);
  const inFile = rowCount[t] || 0;
  if (r.c !== inFile) mismatch.push(`${t}: db=${r.c} file=${inFile}`);
}
ok("jumlah baris per tabel sama dengan database", mismatch.length === 0, mismatch.join(" | "));
const totalFile = Object.values(rowCount).reduce((a, b) => a + b, 0);
console.log(`     total baris di file: ${totalFile}`);

// ── 3. Round-trip escaping lewat parser MariaDB ───────────────────────────
console.log("\n3) Uji escaping literal lewat MariaDB (round-trip)");
// Tabel dengan isi paling rawan: JSON blob, teks panjang, newline
const RISKY = ["hpp_calculations", "audit_logs", "pos", "po_logs", "users", "paper_mutations", "klien_mutations", "tempo_invoices"];
let rtChecked = 0, rtBad = 0;

for (const table of RISKY) {
  if (!dbTables.includes(table)) continue;
  // ambil ulang statement INSERT tabel ini dari file
  const re = new RegExp("INSERT INTO `" + table + "` \\(([^)]+)\\) VALUES\\n([\\s\\S]*?);\\n");
  const mm = sql.match(re);
  if (!mm) { console.log(`     lewati ${table} (tak ada INSERT)`); continue; }
  const cols = mm[1].split(",").map((c) => c.trim().replace(/`/g, ""));
  const tuples = splitTuples(mm[2]).slice(0, 3); // 3 baris pertama per tabel

  const [dbRows] = await conn.query(`SELECT * FROM \`${table}\` LIMIT 3`);

  for (let i = 0; i < tuples.length && i < dbRows.length; i++) {
    const fields = splitFields(tuples[i]);
    // minta MariaDB mem-parse literal itu apa adanya
    const [[parsed]] = await conn.query(
      `SELECT ${fields.map((f, k) => `${f} AS c${k}`).join(", ")}`
    );
    cols.forEach((col, k) => {
      rtChecked++;
      const original = dbRows[i][col];
      const back = parsed[`c${k}`];
      const norm = (v) =>
        v === null || v === undefined ? null
          : Buffer.isBuffer(v) ? v.toString("utf8")
          : typeof v === "object" ? JSON.stringify(v)
          : String(v);
      if (norm(original) !== norm(back)) {
        rtBad++;
        if (rtBad <= 5) console.log(`     BEDA ${table}.${col}: asli=${String(norm(original)).slice(0, 60)} | hasil=${String(norm(back)).slice(0, 60)}`);
      }
    });
  }
  console.log(`     ${table}: ${tuples.length} baris diperiksa`);
}
ok(`escaping akurat (${rtChecked} nilai diuji ulang oleh MariaDB)`, rtBad === 0, `beda=${rtBad}`);

await conn.end();
console.log(`\nHASIL: ${pass} lolos / ${fail} gagal`);
process.exit(fail ? 1 : 0);
