/**
 * Generator dump SQL untuk deploy/dummy_data.sql.
 * mysqldump tidak tersedia di container ini, jadi dump dibuat manual:
 * SHOW CREATE TABLE + INSERT batch per tabel, format kompatibel MariaDB/phpMyAdmin.
 *
 * Jalankan: node /app/tests/gen_dummy_sql.mjs
 */
import mysql from "mysql2/promise";
import { writeFileSync } from "node:fs";
import { getDbConfig } from "./_dbconfig.mjs";

const OUT = process.env.OUT || "/app/deploy/dummy_data.sql";

// Urutan penting: induk sebelum anak (walau FOREIGN_KEY_CHECKS dimatikan).
const ORDER = [
  "settings", "users",
  "paper_mutations", "ink_mutations", "other_mutations",
  "hpp_calculations",
  "pos", "po_schedules", "po_files", "po_logs",
  "klien_clients", "klien_pos", "klien_items", "klien_mutations",
  "tempo_top_options", "tempo_invoices", "tempo_installments",
  "activity_logs", "audit_logs",
];

const conn = await mysql.createConnection({ ...getDbConfig(), dateStrings: true });

/** Escape nilai jadi literal SQL. */
function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (Buffer.isBuffer(v)) return `0x${v.toString("hex")}`;
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\u0000/g, "\\0")
    .replace(/\u001a/g, "\\Z")}'`;
}

const [[verRow]] = await conn.query("SELECT VERSION() v");
const [tablesRaw] = await conn.query("SHOW TABLES");
const present = tablesRaw.map((r) => Object.values(r)[0]);
const tables = [...ORDER.filter((t) => present.includes(t)), ...present.filter((t) => !ORDER.includes(t))];

const counts = {};
let totalRows = 0;
const body = [];

for (const t of tables) {
  const [[createRow]] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
  const ddl = createRow["Create Table"];
  const [rows] = await conn.query(`SELECT * FROM \`${t}\``);
  counts[t] = rows.length;
  totalRows += rows.length;

  body.push("--");
  body.push(`-- Table structure for table \`${t}\``);
  body.push("--\n");
  body.push(`DROP TABLE IF EXISTS \`${t}\`;`);
  body.push("/*!40101 SET @saved_cs_client     = @@character_set_client */;");
  body.push("/*!40101 SET character_set_client = utf8 */;");
  body.push(`${ddl};`);
  body.push("/*!40101 SET character_set_client = @saved_cs_client */;\n");
  body.push("--");
  body.push(`-- Dumping data for table \`${t}\` (${rows.length} baris)`);
  body.push("--\n");
  body.push(`LOCK TABLES \`${t}\` WRITE;`);
  body.push(`/*!40000 ALTER TABLE \`${t}\` DISABLE KEYS */;`);

  if (rows.length) {
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `\`${c}\``).join(", ");
    // batch supaya baris tidak terlalu panjang
    const CHUNK = 25;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const values = rows
        .slice(i, i + CHUNK)
        .map((r) => `(${cols.map((c) => lit(r[c])).join(",")})`)
        .join(",\n");
      body.push(`INSERT INTO \`${t}\` (${colList}) VALUES\n${values};`);
    }
  }

  body.push(`/*!40000 ALTER TABLE \`${t}\` ENABLE KEYS */;`);
  body.push("UNLOCK TABLES;\n");
}

const now = new Date().toISOString().replace("T", " ").slice(0, 19);
const summary = Object.entries(counts).map(([t, c]) => `--   ${t.padEnd(20)} ${String(c).padStart(5)} baris`).join("\n");

const header = `-- =============================================================================
-- SCA PORTAL - data contoh / dummy untuk MariaDB
-- =============================================================================
-- Dump ini dibuat ${now} UTC dari database pengembangan, SETELAH sesi
-- pengujian E2E yang menambahkan 150 record dummy baru lewat API aplikasi
-- (bukan INSERT langsung), sehingga seluruh validasi bisnis & log audit ikut
-- terbentuk secara wajar.
--
-- Isi: ${tables.length} tabel, ${totalRows} baris.
${summary}
--
-- Rincian 150 record dummy yang ditambahkan pada sesi ini:
--   Staff1 (Stok SCA)          : 30 mutasi kertas, 15 mutasi tinta, 15 mutasi lain
--   Staff2 (PO + Stok Klien)   : 12 PO, 12 jadwal produksi, 5 klien,
--                                8 PO klien, 12 item titipan, 16 mutasi klien
--   Staff3 (Tempo + HPP)       : 15 invoice (termasuk cicilan), 10 perhitungan HPP
--
-- Cara impor:
--   phpMyAdmin (https://db.scaportal.cloud) -> database \`default\` -> Import -> file ini
--   atau: mariadb -u mariadb -p default < deploy/dummy_data.sql
--
-- PERINGATAN: file ini memakai DROP TABLE IF EXISTS + CREATE TABLE, jadi akan
-- MENIMPA seluruh tabel yang ada. Jangan dijalankan di database produksi berisi data.
--
-- Login setelah impor:
--   Superadmin  : Jeffsca        / jeff3131
--   Admin/PIC   : kadalgurun546  / kadalgurun546
--   Staff1      : Staff1         / staff1pass   (akses: Stok SCA, Laporan Detail, PDF, Log)
--   Staff2      : Staff2         / staff2pass   (akses: Tracking PO, Stok Klien)
--   Staff3      : Staff3         / staff3pass   (akses: Jatuh Tempo, Kalkulator HPP, Log)
-- (password di atas ikut dari data dummy - WAJIB diganti untuk produksi)
--
-- Section terproteksi (Laporan Detail / Log & User / Tutup Tahun) memakai
-- TEMP_ACCESS_PASSWORD dari environment variable, BUKAN dari dump ini.
-- =============================================================================

-- MariaDB dump (dibuat oleh tests/gen_dummy_sql.mjs)
--
-- Host: MariaDB selfhosted (Coolify)    Database: default
-- ------------------------------------------------------
-- Server version\t${verRow.v}

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

`;

const footer = `/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on ${now}
`;

writeFileSync(OUT, header + body.join("\n") + "\n" + footer, "utf8");
await conn.end();

console.log(`Dump tersimpan: ${OUT}`);
console.log(`Tabel: ${tables.length} | total baris: ${totalRows}`);
Object.entries(counts).forEach(([t, c]) => console.log(`  ${t.padEnd(20)} ${c}`));
