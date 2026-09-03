/**
 * Stok Klien — helper server.
 *
 * Tool ini melacak stok barang milik KLIEN (titipan): Klien > PO > Item > Mutasi.
 * Sengaja memakai koleksi terpisah (klien_*) agar TIDAK menyentuh data
 * Stok SCA (paper/ink/other_mutations) maupun PO Tracker (pos).
 */
import { getDb, COL, nowIso } from "@/server/mongo";
import { HttpError } from "@/server/http";

export const newId = () => crypto.randomUUID();

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

/** Ambil semua data mentah sekali jalan (dipakai dashboard & PDF). */
export async function loadTree() {
  const db = await getDb();
  const [kliens, pos, items] = await Promise.all([
    db.collection(COL.klienClients).find({}, { projection: { _id: 0 } }).sort({ nama: 1 }).toArray(),
    db.collection(COL.klienPos).find({}, { projection: { _id: 0 } }).sort({ tanggal_po: -1 }).toArray(),
    db.collection(COL.klienItems).find({}, { projection: { _id: 0 } }).sort({ created_at: 1 }).toArray(),
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

/** Daftar mutasi + enrich nama klien / no PO / jenis item. */
export async function listMutations({ klien_id, po_id, item_id, jenis, start, end } = {}) {
  const db = await getDb();
  const q = {};
  if (klien_id) q.klien_id = klien_id;
  if (po_id) q.po_id = po_id;
  if (item_id) q.item_id = item_id;
  if (jenis) q.jenis = jenis;
  if (start || end) {
    q.tanggal = {};
    if (start) q.tanggal.$gte = start;
    if (end) q.tanggal.$lte = end;
  }

  const [mutations, items, pos, kliens] = await Promise.all([
    db.collection(COL.klienMutations).find(q, { projection: { _id: 0 } }).sort({ tanggal: -1 }).limit(20000).toArray(),
    db.collection(COL.klienItems).find({}, { projection: { _id: 0 } }).toArray(),
    db.collection(COL.klienPos).find({}, { projection: { _id: 0 } }).toArray(),
    db.collection(COL.klienClients).find({}, { projection: { _id: 0 } }).toArray(),
  ]);

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const poMap = new Map(pos.map((p) => [p.id, p]));
  const klienMap = new Map(kliens.map((k) => [k.id, k]));

  return mutations.map((m) => {
    const it = itemMap.get(m.item_id) || {};
    const po = poMap.get(m.po_id) || {};
    const kl = klienMap.get(m.klien_id || po.klien_id) || {};
    return {
      ...m,
      jenis_item: it.jenis_item ?? "-",
      satuan: it.satuan ?? "",
      no_po: po.no_po ?? "-",
      nama_klien: kl.nama ?? "-",
    };
  });
}

export async function getItemOr404(id) {
  const db = await getDb();
  const item = await db.collection(COL.klienItems).findOne({ id }, { projection: { _id: 0 } });
  if (!item) throw new HttpError(404, "Item tidak ditemukan");
  return item;
}

export async function getPoOr404(id) {
  const db = await getDb();
  const po = await db.collection(COL.klienPos).findOne({ id }, { projection: { _id: 0 } });
  if (!po) throw new HttpError(404, "PO tidak ditemukan");
  return po;
}

export async function getKlienOr404(id) {
  const db = await getDb();
  const k = await db.collection(COL.klienClients).findOne({ id }, { projection: { _id: 0 } });
  if (!k) throw new HttpError(404, "Klien tidak ditemukan");
  return k;
}

export { nowIso };
