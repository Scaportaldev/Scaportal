import { query, queryOne, insertRow, updateRow, deleteRows, fromRow, fromRows, toDateTime } from "@/server/db";

const SPEC = { bools: ["active"] };
const DT_COLS = new Set(["created_at", "updated_at", "password_changed_at"]);

function toRow(obj) {
  const row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    row[k] = DT_COLS.has(k) ? toDateTime(v) : v;
  }
  return row;
}

export async function findUserById(id) {
  return fromRow(await queryOne("SELECT * FROM `users` WHERE `id`=?", [id]), SPEC);
}

export async function findUserByUsername(username) {
  return fromRow(await queryOne("SELECT * FROM `users` WHERE `username`=?", [username]), SPEC);
}

export async function listUsers() {
  return fromRows(await query("SELECT * FROM `users` ORDER BY `created_at` ASC"), SPEC);
}

export async function insertUser(doc) {
  await insertRow("users", toRow(doc));
  return doc;
}

export async function updateUser(id, set) {
  return await updateRow("users", toRow(set), { id });
}

export async function deleteUser(id) {
  return await deleteRows("users", { id });
}

/** Hilangkan field sensitif sebelum dikirim ke klien. */
export function safeUser(u) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
}
