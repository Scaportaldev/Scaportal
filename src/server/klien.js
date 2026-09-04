/**
 * Stok Klien — helper server (MariaDB).
 *
 * Hirarki: klien_clients > klien_pos > klien_items > klien_mutations.
 * FK ON DELETE CASCADE menangani penghapusan berjenjang di sisi database.
 */
import {
  query, queryOne, insertRow, updateRow, deleteRows, withTx,
  fromRow, fromRows, toDateTime, toDate, nowIso, newId,
} from "@/server/db";
import { HttpError } from "@/server/http";

export { nowIso, newId };

export const ITEM_STATUS = ["aktif", "selesai"];
export const MUTASI_JENIS = ["masuk", "keluar"];

export function validateItemStatus(status) {
  if (!ITEM_STATUS.includes(status)) {
    throw new HttpError(400, "Status harus 'aktif' atau 'selesai'");
  }
}

export function validateMutasiJenis(jenis) {
  if (!MUTASI_JENIS.includes(jenis)) {
    throw new HttpError(400, "Jenis mutasi harus 'masuk' atau 'keluar'");
  }
}

export function num(v, fallback = 0) {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : fallback;
}

// ---------------- Klien ----------------
export async function listKliens() {
  return fromRows(await query("SELECT * FROM `klien_clients` ORDER BY `nama` ASC LIMIT 10000"));
}

export async function getKlienOr404(id) {
  const k = fromRow(await queryOne("SELECT * FROM `klien_clients` WHERE `id`=?", [id]));
  if (!k) throw new HttpError(404, "Klien tidak ditemukan");
  return k;
}

/** Cari klien dengan nama sama (case-insensitive lewat collation), opsional kecualikan id. */
export async function findKlienByNama(nama, excludeId = null) {
  const row = excludeId
    ? await queryOne("SELECT * FROM `klien_clients` WHERE `nama`=? AND `id`<>?", [nama, excludeId])
    : await queryOne("SELECT * FROM `klien_clients` WHERE `nama`=?", [nama]);
  return fromRow(row);
}

export async function insertKlien(doc) {
  await insertRow("klien_clients", { ...doc, created_at: toDateTime(doc.created_at) });
  return doc;
}

export async function updateKlien(id, set) {
  return await updateRow("klien_clients", set, { id });
}

/** Hapus klien; kembalikan jumlah PO & item yang ikut terhapus (cascade). */
export async function deleteKlienCascade(id) {
  const pos = await query("SELECT `id` FROM `klien_pos` WHERE `klien_id`=?", [id]);
  const poIds = pos.map((p) => p.id);
  let items = 0;
  if (poIds.length) {
    const r = await queryOne(
      `SELECT COUNT(*) AS c FROM \`klien_items\` WHERE \`po_id\` IN (${poIds.map(() => "?").join(",")})`, poIds,
    );
    items = Number(r?.c || 0);
  }
  await deleteRows("klien_clients", { id });
  return { pos: poIds.length, items };
}

// ---------------- PO Klien ----------------
export async function listKlienPos(klienId = null) {
  const rows = klienId
    ? await query("SELECT * FROM `klien_pos` WHERE `klien_id`=? ORDER BY `created_at` DESC LIMIT 10000", [klienId])
    : await query("SELECT * FROM `klien_pos` ORDER BY `created_at` DESC LIMIT 10000");
  return fromRows(rows);
}

export async function getPoOr404(id) {
  const po = fromRow(await queryOne("SELECT * FROM `klien_pos` WHERE `id`=?", [id]));
  if (!po) throw new HttpError(404, "PO tidak ditemukan");
  return po;
}

export async function findKlienPoDup(klienId, noPo, excludeId = null) {
  const row = excludeId
    ? await queryOne("SELECT * FROM `klien_pos` WHERE `klien_id`=? AND `no_po`=? AND `id`<>?", [klienId, noPo, excludeId])
    : await queryOne("SELECT * FROM `klien_pos` WHERE `klien_id`=? AND `no_po`=?", [klienId, noPo]);
  return fromRow(row);
}

export async function insertKlienPo(doc) {
  await insertRow("klien_pos", {
    ...doc,
    tanggal_po: toDate(doc.tanggal_po) || toDate(nowIso()),
    created_at: toDateTime(doc.created_at),
  });
  return doc;
}

export async function updateKlienPo(id, set) {
  const row = { ...set };
  if (row.tanggal_po !== undefined) row.tanggal_po = toDate(row.tanggal_po);
  return await updateRow("klien_pos", row, { id });
}

export async function deleteKlienPoCascade(id) {
  const r = await queryOne("SELECT COUNT(*) AS c FROM `klien_items` WHERE `po_id`=?", [id]);
  await deleteRows("klien_pos", { id });
  return { items: Number(r?.c || 0) };
}

// ---------------- Item ----------------
export async function listItems(poId = null) {
  const rows = poId
    ? await query("SELECT * FROM `klien_items` WHERE `po_id`=? ORDER BY `created_at` ASC LIMIT 100000", [poId])
    : await query("SELECT * FROM `klien_items` ORDER BY `created_at` ASC LIMIT 100000");
  return fromRows(rows);
}

export async function getItemOr404(id) {
  const item = fromRow(await queryOne("SELECT * FROM `klien_items` WHERE `id`=?", [id]));
  if (!item) throw new HttpError(404, "Item tidak ditemukan");
  return item;
}

export async function insertItem(doc) {
  await insertRow("klien_items", { ...doc, created_at: toDateTime(doc.created_at) });
  return doc;
}

export async function updateItem(id, set) {
  return await updateRow("klien_items", set, { id });
}

export async function deleteItemCascade(id) {
  return await deleteRows("klien_items", { id });
}

// ---------------- Mutasi ----------------
export async function getMutationOr404(id) {
  const m = fromRow(await queryOne("SELECT * FROM `klien_mutations` WHERE `id`=?", [id]));
  if (!m) throw new HttpError(404, "Mutasi tidak ditemukan");
  return m;
}

/** Insert mutasi + update kuantiti item dalam satu transaksi. */
export async function insertMutationTx(doc, newQty) {
  await withTx(async (conn) => {
    await insertRow("klien_mutations", {
      ...doc,
      tanggal: toDateTime(doc.tanggal) || toDateTime(nowIso()),
      created_at: toDateTime(doc.created_at),
    }, conn);
    await updateRow("klien_items", { kuantiti: newQty }, { id: doc.item_id }, conn);
  });
  return doc;
}

export async function updateMutationTx(id, set, itemId, newQty) {
  const row = { ...set };
  if (row.tanggal !== undefined) row.tanggal = toDateTime(row.tanggal);
  await withTx(async (conn) => {
    await updateRow("klien_mutations", row, { id }, conn);
    await updateRow("klien_items", { kuantiti: newQty }, { id: itemId }, conn);
  });
}

export async function deleteMutationTx(id, itemId, newQty) {
  await withTx(async (conn) => {
    if (itemId !== null && itemId !== undefined) {
      await updateRow("klien_items", { kuantiti: newQty }, { id: itemId }, conn);
    }
    await deleteRows("klien_mutations", { id }, conn);
  });
}

/** Ambil semua data mentah sekali jalan (dipakai dashboard & PDF). */
export async function loadTree() {
  const [kliens, pos, items] = await Promise.all([
    fromRows(await query("SELECT * FROM `klien_clients` ORDER BY `nama` ASC")),
    fromRows(await query("SELECT * FROM `klien_pos` ORDER BY `tanggal_po` DESC, `created_at` DESC")),
    fromRows(await query("SELECT * FROM `klien_items` ORDER BY `created_at` ASC")),
  ]);

  const itemsByPo = new Map();
  items.forEach((it) => {
    if (!itemsByPo.has(it.po_id)) itemsByPo.set(it.po_id, []);
    itemsByPo.get(it.po_id).push(it);
  });

  const posByKlien = new Map();
  pos.forEach((p) => {
    p.items = itemsByPo.get(p.id) || [];
    p.item_aktif_count = p.items.filter((i) => i.status === "aktif").length;
    p.total_stok = p.items.reduce((s, i) => s + num(i.kuantiti), 0);
    if (!posByKlien.has(p.klien_id)) posByKlien.set(p.klien_id, []);
    posByKlien.get(p.klien_id).push(p);
  });

  const tree = kliens.map((k) => {
    const kpos = posByKlien.get(k.id) || [];
    return {
      ...k,
      pos: kpos,
      po_count: kpos.length,
      item_count: kpos.reduce((s, p) => s + p.items.length, 0),
    };
  });

  const summary = {
    total_klien: kliens.length,
    total_po_aktif: pos.filter((p) => p.item_aktif_count > 0).length,
    total_item_aktif: items.filter((i) => i.status === "aktif").length,
    total_item_selesai: items.filter((i) => i.status === "selesai").length,
  };

  return { summary, kliens: tree, rawPos: pos, rawItems: items, rawKliens: kliens };
}

/** Daftar mutasi + enrich nama klien / no PO / jenis item (JOIN). */
export async function listMutations({ klien_id, po_id, item_id, jenis, start, end } = {}) {
  const where = [];
  const params = [];
  if (klien_id) { where.push("m.`klien_id`=?"); params.push(klien_id); }
  if (po_id) { where.push("m.`po_id`=?"); params.push(po_id); }
  if (item_id) { where.push("m.`item_id`=?"); params.push(item_id); }
  if (jenis) { where.push("m.`jenis`=?"); params.push(jenis); }
  if (start) { where.push("m.`tanggal`>=?"); params.push(toDateTime(start)); }
  if (end) {
    // end inklusif: bila hanya tanggal, geser ke akhir hari
    const e = /^\d{4}-\d{2}-\d{2}$/.test(String(end)) ? `${end}T23:59:59.999Z` : end;
    where.push("m.`tanggal`<=?"); params.push(toDateTime(e));
  }
  const sql = `
    SELECT m.*, i.\`jenis_item\`, i.\`satuan\`, p.\`no_po\`, k.\`nama\` AS nama_klien
    FROM \`klien_mutations\` m
    LEFT JOIN \`klien_items\` i ON i.\`id\` = m.\`item_id\`
    LEFT JOIN \`klien_pos\` p ON p.\`id\` = m.\`po_id\`
    LEFT JOIN \`klien_clients\` k ON k.\`id\` = COALESCE(m.\`klien_id\`, p.\`klien_id\`)
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY m.\`tanggal\` DESC, m.\`created_at\` DESC
    LIMIT 20000`;
  const rows = fromRows(await query(sql, params));
  return rows.map((m) => ({
    ...m,
    jenis_item: m.jenis_item ?? "-",
    satuan: m.satuan ?? "",
    no_po: m.no_po ?? "-",
    nama_klien: m.nama_klien ?? "-",
    // Nama User penginput: username login; data lama (sebelum kolom ada) pakai pic_name.
    user_name: m.user_name || m.pic_name || "-",
  }));
}
