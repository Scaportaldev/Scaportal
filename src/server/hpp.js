import { query, queryOne, insertRow, updateRow, deleteRows, fromRow, fromRows, toDateTime } from "@/server/db";

const SPEC = { json: ["inputs", "result"] };

function toRow(doc) {
  const row = { ...doc };
  if (row.created_at !== undefined) row.created_at = toDateTime(row.created_at);
  if (row.updated_at !== undefined) row.updated_at = toDateTime(row.updated_at);
  return row;
}

export async function listCalculations(limit = 500) {
  return fromRows(await query("SELECT * FROM `hpp_calculations` ORDER BY `updated_at` DESC LIMIT ?", [Number(limit)]), SPEC);
}

export async function getCalculation(id) {
  return fromRow(await queryOne("SELECT * FROM `hpp_calculations` WHERE `id`=?", [id]), SPEC);
}

export async function insertCalculation(doc) {
  await insertRow("hpp_calculations", toRow(doc));
  return doc;
}

export async function updateCalculation(id, set) {
  return await updateRow("hpp_calculations", toRow(set), { id });
}

export async function deleteCalculation(id) {
  const res = await deleteRows("hpp_calculations", { id });
  return res.affectedRows;
}
