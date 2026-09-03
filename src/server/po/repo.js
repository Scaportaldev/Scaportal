/**
 * PO Tracker — akses tabel (MariaDB).
 * pos (1) --< po_logs, po_schedules, po_files  (FK ON DELETE CASCADE)
 *
 * `enabled_stages` & `stage_data` disimpan JSON karena isinya form bebas per tahap
 * (checkbox, catatan, foto, jadwal kirim) yang berbeda-beda tiap tahap.
 */
import {
  query, queryOne, insertRow, updateRow, deleteRows, withTx,
  fromRow, fromRows, toDateTime, toDate, nowIso, likeContains,
} from "@/server/db";
import { cached, invalidate, TAG_PO } from "@/server/cache";

const PO_SPEC = { jsonArrays: ["enabled_stages"], json: ["stage_data"] };
const PO_COLS = [
  "id", "po_number", "client_name", "item_type", "material", "paper_size", "quantity",
  "po_date", "est_start", "est_end", "print_machine", "enabled_stages", "stage_data", "notes",
  "created_by", "created_by_username", "created_at", "updated_at",
];

function poRow(obj) {
  const row = {};
  for (const c of PO_COLS) {
    if (obj[c] === undefined) continue;
    let v = obj[c];
    if (c === "created_at" || c === "updated_at") v = toDateTime(v);
    else if (c === "po_date" || c === "est_start" || c === "est_end") v = toDate(v);
    else if (c === "enabled_stages") v = Array.isArray(v) ? v : [];
    else if (c === "stage_data") v = v && typeof v === "object" ? v : {};
    row[c] = v;
  }
  return row;
}

function logFromRow(r) {
  return {
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    message: r.message,
    user: r.user_name,
  };
}

async function attachLogs(pos) {
  if (!pos.length) return pos;
  const ids = pos.map((p) => p.id);
  const rows = await query(
    `SELECT * FROM \`po_logs\` WHERE \`po_id\` IN (${ids.map(() => "?").join(",")}) ORDER BY \`timestamp\` ASC, \`id\` ASC`,
    ids,
  );
  const byPo = new Map();
  for (const r of rows) {
    if (!byPo.has(r.po_id)) byPo.set(r.po_id, []);
    byPo.get(r.po_id).push(logFromRow(r));
  }
  return pos.map((p) => ({ ...p, logs: byPo.get(p.id) || [] }));
}

// ---------------- PO ----------------
/**
 * Daftar PO. Filter `search` (no PO / klien / jenis item, case-insensitive) dan
 * `month` ('YYYY-MM' dari po_date, fallback est_start) dijalankan di SQL —
 * semantik sama dengan filterPos() lama, hanya dipindah dari JS ke database.
 */
export async function listPos({ limit = 2000, withLogs = false, search = null, month = null } = {}) {
  const where = [];
  const params = [];
  if (search) {
    const s = likeContains(search);
    where.push("(`po_number` LIKE ? OR `client_name` LIKE ? OR `item_type` LIKE ?)");
    params.push(s, s, s);
  }
  if (month) {
    where.push("DATE_FORMAT(COALESCE(`po_date`, `est_start`), '%Y-%m') = ?");
    params.push(String(month));
  }
  const sql = `SELECT * FROM \`pos\`${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY \`created_at\` DESC LIMIT ?`;
  params.push(Number(limit));
  const pos = fromRows(await query(sql, params), PO_SPEC);
  return withLogs ? await attachLogs(pos) : pos.map((p) => ({ ...p, logs: [] }));
}

/** Daftar bulan ('YYYY-MM', terbaru dulu) yang punya PO — untuk dropdown filter. */
export async function listPoMonths() {
  return await cached(TAG_PO, "months", listPoMonthsUncached);
}

async function listPoMonthsUncached() {
  const rows = await query(
    "SELECT DISTINCT DATE_FORMAT(COALESCE(`po_date`, `est_start`), '%Y-%m') AS ym FROM `pos` " +
    "WHERE COALESCE(`po_date`, `est_start`) IS NOT NULL ORDER BY ym DESC",
  );
  return rows.map((r) => r.ym).filter((x) => typeof x === "string" && x.length === 7);
}

/**
 * PO yang rentang estimasinya beririsan dengan [estStart, estEnd]
 * (semantik rangesOverlap: s1 <= e2 && s2 <= e1; PO tanpa est_start/est_end diabaikan).
 */
export async function listPosOverlapping(estStart, estEnd, excludeId = null) {
  const params = [toDate(estEnd), toDate(estStart)];
  let sql = "SELECT * FROM `pos` WHERE `est_start` IS NOT NULL AND `est_end` IS NOT NULL AND `est_start` <= ? AND `est_end` >= ?";
  if (excludeId) { sql += " AND `id` <> ?"; params.push(excludeId); }
  sql += " ORDER BY `created_at` DESC";
  return fromRows(await query(sql, params), PO_SPEC).map((p) => ({ ...p, logs: [] }));
}

export async function getPo(id) {
  const po = fromRow(await queryOne("SELECT * FROM `pos` WHERE `id`=?", [id]), PO_SPEC);
  if (!po) return null;
  return (await attachLogs([po]))[0];
}

export async function findPoByNumber(poNumber, excludeId = null) {
  const row = excludeId
    ? await queryOne("SELECT `id` FROM `pos` WHERE `po_number`=? AND `id`<>?", [poNumber, excludeId])
    : await queryOne("SELECT `id` FROM `pos` WHERE `po_number`=?", [poNumber]);
  return row || null;
}

/** Insert PO beserta log awal (doc.logs) dalam satu transaksi. */
export async function insertPo(doc) {
  await withTx(async (conn) => {
    await insertRow("pos", poRow(doc), conn);
    for (const l of doc.logs || []) await insertLog(doc.id, l, conn);
  });
  invalidate(TAG_PO);
  return doc;
}

/** Update kolom PO + tambahkan log baru (opsional) dalam satu transaksi. */
export async function updatePo(id, set, newLogs = []) {
  await withTx(async (conn) => {
    const row = poRow(set);
    if (Object.keys(row).length) await updateRow("pos", row, { id }, conn);
    for (const l of newLogs) await insertLog(id, l, conn);
  });
  invalidate(TAG_PO);
}

async function insertLog(poId, log, conn) {
  await insertRow("po_logs", {
    po_id: poId,
    timestamp: toDateTime(log.timestamp || nowIso()),
    message: String(log.message || ""),
    user_name: log.user ?? null,
  }, conn);
}

export async function deletePo(id) {
  const res = await deleteRows("pos", { id }); // cascade: po_logs, po_schedules, po_files
  invalidate(TAG_PO);
  return res;
}

// ---------------- Jadwal ----------------
export async function listSchedules(limit = 3000) {
  return fromRows(await query("SELECT * FROM `po_schedules` ORDER BY `date` ASC, `created_at` ASC LIMIT ?", [Number(limit)]));
}

export async function insertSchedule(doc) {
  await insertRow("po_schedules", { ...doc, date: toDate(doc.date), created_at: toDateTime(doc.created_at) });
  invalidate(TAG_PO);
  return doc;
}

export async function deleteSchedule(id) {
  const res = await deleteRows("po_schedules", { id });
  invalidate(TAG_PO);
  return res;
}

// ---------------- File / foto ----------------
const FILE_SPEC = { bools: ["is_deleted"] };

export async function getFile(id, { includeDeleted = false } = {}) {
  const row = includeDeleted
    ? await queryOne("SELECT * FROM `po_files` WHERE `id`=?", [id])
    : await queryOne("SELECT * FROM `po_files` WHERE `id`=? AND `is_deleted`=0", [id]);
  return fromRow(row, FILE_SPEC);
}

export async function insertFile(doc) {
  await insertRow("po_files", {
    ...doc,
    is_deleted: doc.is_deleted ? 1 : 0,
    created_at: toDateTime(doc.created_at),
    deleted_at: toDateTime(doc.deleted_at),
  });
  invalidate(TAG_PO);
  return doc;
}

export async function markFileDeleted(id) {
  const res = await updateRow("po_files", { is_deleted: 1, deleted_at: toDateTime(nowIso()) }, { id });
  invalidate(TAG_PO);
  return res;
}
