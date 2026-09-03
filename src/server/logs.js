import { query, insertRow, updateRow, fromRows, toDateTime, nowIso } from "@/server/db";

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

export async function listActivity(limit = 1000) {
  return fromRows(await query("SELECT * FROM `activity_logs` ORDER BY `login_time` DESC LIMIT ?", [Number(limit)]));
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

export async function listAudit(limit = 1000) {
  const rows = await query("SELECT * FROM `audit_logs` ORDER BY `timestamp` DESC LIMIT ?", [Number(limit)]);
  return fromRows(rows, { json: ["before_data", "after_data"] }).map((r) => {
    const { before_data, after_data, ...rest } = r;
    return { ...rest, before: before_data ?? null, after: after_data ?? null };
  });
}

// dipakai untuk kompatibilitas nama lama
export { updateRow as _updateRow };
