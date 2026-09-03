import { queryOne, insertRow, updateRow, toDateTime, nowIso } from "@/server/db";

/** Ambil nilai setting (string) atau null. */
export async function getSetting(key) {
  const row = await queryOne("SELECT `value` FROM `settings` WHERE `key`=?", [key]);
  return row ? row.value : null;
}

/** Upsert setting. */
export async function setSetting(key, value) {
  const now = toDateTime(nowIso());
  const res = await updateRow("settings", { value: String(value), updated_at: now }, { key });
  if (!res.affectedRows) {
    await insertRow("settings", { key, value: String(value), updated_at: now });
  }
}
