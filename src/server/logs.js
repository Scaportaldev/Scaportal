import { query, queryOne, insertRow, updateRow, fromRow, fromRows, toDateTime, nowIso } from "@/server/db";

// ---------------- Log aktivitas (login/logout) ----------------
export async function insertActivity({ id, user_id, name, username, login_time }) {
  await insertRow("activity_logs", {
    id, user_id, name, username,
    login_time: toDateTime(login_time || nowIso()),
    logout_time: null,
    logout_type: null,
  });
}

/** Tutup sesi (hanya bila belum ditutup). */
export async function closeActivity(sid, label) {
  await query(
    "UPDATE `activity_logs` SET `logout_time`=?, `logout_type`=? WHERE `id`=? AND `logout_time` IS NULL",
    [toDateTime(nowIso()), label, sid],
  );
}

/**
 * Daftar log aktivitas.
 * - listActivity(1000)               -> array (perilaku lama)
 * - listActivity({ pageSize, offset }) -> { items, total } (pagination server)
 */
export async function listActivity(opts = 1000) {
  if (typeof opts === "number") {
    return fromRows(await query("SELECT * FROM `activity_logs` ORDER BY `login_time` DESC LIMIT ?", [Number(opts)]));
  }
  const { pageSize, offset } = opts;
  const [rows, cnt] = await Promise.all([
    query("SELECT * FROM `activity_logs` ORDER BY `login_time` DESC LIMIT ? OFFSET ?", [Number(pageSize), Number(offset)]),
    queryOne("SELECT COUNT(*) AS n FROM `activity_logs`"),
  ]);
  return { items: fromRows(rows), total: Number(cnt?.n || 0) };
}

// ---------------- Log audit ----------------
export async function insertAudit({ id, user_id, name, action, mutation_type, mutation_id, before, after, timestamp }) {
  await insertRow("audit_logs", {
    id, user_id, name, action,
    mutation_type: mutation_type ?? null,
    mutation_id: mutation_id ?? null,
    before_data: before ?? null,
    after_data: after ?? null,
    timestamp: toDateTime(timestamp || nowIso()),
  });
}

function mapAuditFull(r) {
  const { before_data, after_data, ...rest } = r;
  return { ...rest, before: before_data ?? null, after: after_data ?? null };
}

/**
 * Daftar log audit.
 * - listAudit(1000)                  -> array lengkap (termasuk before/after) — perilaku lama
 * - listAudit({ pageSize, offset })  -> { items, total }; items TANPA kolom JSON before/after
 *   (payload ringan), tetapi memuat `has_detail`. Detail diambil via getAudit(id).
 */
export async function listAudit(opts = 1000) {
  if (typeof opts === "number") {
    const rows = await query("SELECT * FROM `audit_logs` ORDER BY `timestamp` DESC LIMIT ?", [Number(opts)]);
    return fromRows(rows, { json: ["before_data", "after_data"] }).map(mapAuditFull);
  }
  const { pageSize, offset } = opts;
  const [rows, cnt] = await Promise.all([
    query(
      "SELECT `id`,`user_id`,`name`,`action`,`mutation_type`,`mutation_id`,`timestamp`, " +
      "(`before_data` IS NOT NULL OR `after_data` IS NOT NULL) AS `has_detail` " +
      "FROM `audit_logs` ORDER BY `timestamp` DESC LIMIT ? OFFSET ?",
      [Number(pageSize), Number(offset)],
    ),
    queryOne("SELECT COUNT(*) AS n FROM `audit_logs`"),
  ]);
  return { items: fromRows(rows, { bools: ["has_detail"] }), total: Number(cnt?.n || 0) };
}

/** Satu baris audit lengkap (before/after) — dipakai saat user membuka detail. */
export async function getAudit(id) {
  const row = fromRow(await queryOne("SELECT * FROM `audit_logs` WHERE `id`=?", [id]), { json: ["before_data", "after_data"] });
  return row ? mapAuditFull(row) : null;
}

// dipakai untuk kompatibilitas nama lama
export { updateRow as _updateRow };
