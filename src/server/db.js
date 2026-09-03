/**
 * Koneksi MariaDB / MySQL (driver mysql2) + helper SQL kecil.
 *
 * Konfigurasi lewat env:
 *   DATABASE_URL = mysql://user:password@host:3306/nama_db   (format Coolify)
 *   atau DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *
 * Pool di-cache di globalThis supaya hot-reload Next.js tidak membuat pool baru
 * setiap kali modul di-evaluasi ulang.
 */
import mysql from "mysql2/promise";

const g = globalThis;

function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database: (u.pathname || "/").slice(1) || "sca_portal",
    ssl: u.searchParams.get("ssl") === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

export function dbConfig() {
  const url = process.env.DATABASE_URL || process.env.MARIADB_URL || process.env.MYSQL_URL;
  const base = url
    ? parseDatabaseUrl(url)
    : {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "sca_portal",
      };
  return {
    ...base,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    // Semua DATETIME disimpan & dibaca sebagai UTC, dikembalikan ke API sebagai ISO string.
    timezone: "Z",
    // Kolom DATE tetap string 'YYYY-MM-DD'; DATETIME menjadi objek Date (dikonversi di fromRow).
    dateStrings: ["DATE"],
    // DECIMAL dikembalikan sebagai number, bukan string.
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    charset: "utf8mb4_unicode_ci",
    connectTimeout: 15000,
    multipleStatements: false,
  };
}

export function getPool() {
  if (!g.__scaPool) {
    if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
      console.warn("[db] DATABASE_URL belum diset — API akan gagal sampai env diisi.");
    }
    g.__scaPool = mysql.createPool(dbConfig());
  }
  return g.__scaPool;
}

/** Jalankan query, kembalikan rows (SELECT) atau ResultSetHeader (INSERT/UPDATE/DELETE). */
export async function query(sql, params = [], conn = null) {
  const ex = conn || getPool();
  const [rows] = await ex.query(sql, params);
  return rows;
}

export async function queryOne(sql, params = [], conn = null) {
  const rows = await query(sql, params, conn);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Transaksi: fn(conn) — commit bila sukses, rollback bila throw. */
export async function withTx(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch { /* abaikan */ }
    throw e;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Helper identifier & nilai
// ---------------------------------------------------------------------------
export const q = (ident) => "`" + String(ident).replace(/`/g, "") + "`";

function toParam(v) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (v instanceof Date) return v;
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

export async function insertRow(table, row, conn = null) {
  const cols = Object.keys(row).filter((c) => row[c] !== undefined);
  const sql = `INSERT INTO ${q(table)} (${cols.map(q).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
  return await query(sql, cols.map((c) => toParam(row[c])), conn);
}

export async function updateRow(table, set, where, conn = null) {
  const sc = Object.keys(set).filter((c) => set[c] !== undefined);
  const wc = Object.keys(where);
  if (!sc.length) return { affectedRows: 0 };
  const sql = `UPDATE ${q(table)} SET ${sc.map((c) => `${q(c)}=?`).join(",")} WHERE ${wc.map((c) => `${q(c)}=?`).join(" AND ")}`;
  return await query(sql, [...sc.map((c) => toParam(set[c])), ...wc.map((c) => toParam(where[c]))], conn);
}

export async function deleteRows(table, where = {}, conn = null) {
  const wc = Object.keys(where);
  const sql = `DELETE FROM ${q(table)}${wc.length ? ` WHERE ${wc.map((c) => `${q(c)}=?`).join(" AND ")}` : ""}`;
  return await query(sql, wc.map((c) => toParam(where[c])), conn);
}

/** Placeholder "?, ?, ?" untuk klausa IN (...). Mengembalikan null bila list kosong. */
export function inList(arr) {
  if (!arr || !arr.length) return null;
  return arr.map(() => "?").join(",");
}

// ---------------------------------------------------------------------------
// Konversi nilai
// ---------------------------------------------------------------------------
export const nowIso = () => new Date().toISOString();
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const currentYear = () => new Date().getFullYear();
export const newId = () => crypto.randomUUID();

/** ISO string / Date -> objek Date untuk kolom DATETIME (null bila kosong/invalid). */
export function toDateTime(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Nilai apa pun -> 'YYYY-MM-DD' untuk kolom DATE (null bila tidak valid). */
export function toDate(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseJsonSafe(v, fallback) {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

/**
 * Ubah baris SQL menjadi objek API:
 * - Date -> ISO string
 * - kolom di spec.bools -> boolean
 * - kolom di spec.json -> JSON.parse (fallback {} / [] sesuai spec.jsonArrays)
 * - kolom di spec.drop -> dihapus
 */
export function fromRow(row, spec = {}) {
  if (!row) return null;
  const out = {};
  const bools = new Set(spec.bools || []);
  const json = new Set(spec.json || []);
  const jsonArrays = new Set(spec.jsonArrays || []);
  const drop = new Set(spec.drop || []);
  for (const [k, v] of Object.entries(row)) {
    if (drop.has(k)) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (bools.has(k)) out[k] = v === null || v === undefined ? null : !!Number(v);
    else if (json.has(k)) out[k] = parseJsonSafe(v, {});
    else if (jsonArrays.has(k)) out[k] = parseJsonSafe(v, []);
    else out[k] = v;
  }
  return out;
}

export function fromRows(rows, spec) {
  return (rows || []).map((r) => fromRow(r, spec));
}
