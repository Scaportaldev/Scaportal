import { getDb, COLLECTION_BY_TYPE, stripId, nowIso, todayStr } from "@/server/mongo";
import { HttpError } from "@/server/http";
import {
  computeHargaPerRim, currentPaperStockForKey, currentInkStockForKey, currentOtherStockForKey,
} from "@/server/stock";

export const TYPES = ["paper", "ink", "other"];

export function collectionFor(type) {
  const c = COLLECTION_BY_TYPE[type];
  if (!c) throw new HttpError(404, "Jenis mutasi tidak dikenal");
  return c;
}

export const NAME_FIELD = { paper: "jenis_kertas", ink: "jenis_tinta", other: "nama_barang" };

const num = (v) => Number(v || 0);
const str = (v) => String(v ?? "").trim();
const yearOf = (date) => Number(String(date).slice(0, 4));

function requireDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    throw new HttpError(400, "Tanggal tidak valid");
  }
}

function requireTrx(t) {
  if (!["masuk", "keluar", "retur"].includes(t)) {
    throw new HttpError(400, "Jenis transaksi tidak valid");
  }
}

export function buildDoc(type, data) {
  requireDate(data.date);
  requireTrx(data.jenis_transaksi);
  const isMasuk = data.jenis_transaksi === "masuk";
  const jumlah = num(data.jumlah);
  if (!(jumlah > 0)) throw new HttpError(400, "Jumlah harus lebih dari 0");

  const base = {
    date: data.date,
    year: yearOf(data.date),
    kode: str(data.kode),
    jenis_transaksi: data.jenis_transaksi,
    jumlah,
    supplier: str(data.supplier),
    pic_name: str(data.pic_name),
    ppn_ada: isMasuk ? !!data.ppn_ada : false,
    ppn_nominal: isMasuk && data.ppn_ada ? num(data.ppn_nominal) : 0,
    ref_mutation_id: data.jenis_transaksi === "retur" ? data.ref_mutation_id || null : null,
  };

  if (type === "paper") {
    if (!str(data.jenis_kertas)) throw new HttpError(400, "Jenis kertas wajib diisi");
    const gramatur = num(data.gramatur), panjang = num(data.panjang), lebar = num(data.lebar);
    return {
      ...base,
      jenis_kertas: str(data.jenis_kertas),
      gramatur, panjang, lebar,
      price_mode: isMasuk ? data.price_mode || "per_rim" : null,
      price_input: isMasuk ? num(data.price_input) : null,
      harga_per_rim: isMasuk
        ? computeHargaPerRim(data.price_mode || "per_rim", data.price_input, gramatur, panjang, lebar, jumlah)
        : 0,
    };
  }
  if (type === "ink") {
    if (!str(data.jenis_tinta)) throw new HttpError(400, "Jenis tinta wajib diisi");
    return {
      ...base,
      jenis_tinta: str(data.jenis_tinta),
      harga_per_kg: isMasuk ? num(data.harga_per_kg) : 0,
    };
  }
  if (!str(data.nama_barang)) throw new HttpError(400, "Nama barang wajib diisi");
  return {
    ...base,
    nama_barang: str(data.nama_barang),
    satuan: str(data.satuan),
    harga_per_satuan: isMasuk ? num(data.harga_per_satuan) : 0,
  };
}

export function canModify(current, mutation) {
  if (current.role === "superadmin") return [true, ""];
  if (mutation.created_by !== current.id) {
    return [false, "Anda hanya bisa mengubah mutasi yang Anda input sendiri"];
  }
  if (String(mutation.created_at || "").slice(0, 10) !== todayStr()) {
    return [false, "Mutasi hanya bisa diubah/hapus di hari yang sama saat dibuat"];
  }
  return [true, ""];
}

async function yearMutations(type, year) {
  const db = await getDb();
  const docs = await db.collection(collectionFor(type)).find({ year }).toArray();
  return docs.map(stripId);
}

/** Validasi stok untuk transaksi Keluar. */
export async function assertStockAvailable(type, doc, excludeId = null) {
  if (doc.jenis_transaksi !== "keluar") return;
  const muts = await yearMutations(type, doc.year);
  let avail, unit;
  if (type === "paper") {
    avail = currentPaperStockForKey(muts, doc.jenis_kertas, doc.gramatur, doc.panjang, doc.lebar, excludeId);
    unit = "Rim";
  } else if (type === "ink") {
    avail = currentInkStockForKey(muts, doc.jenis_tinta, excludeId);
    unit = "Kg";
  } else {
    avail = currentOtherStockForKey(muts, doc.nama_barang, excludeId);
    unit = doc.satuan || "unit";
  }
  if (doc.jumlah > avail) {
    throw new HttpError(400, `Stok tidak cukup, sisa stok saat ini: ${avail} ${unit}`);
  }
}

export function filterRows(rows, { start, end, jenis, transaksi, supplier, search }, type) {
  const nameField = NAME_FIELD[type];
  const out = rows.filter((d) => {
    if (start && d.date < start) return false;
    if (end && d.date > end) return false;
    if (jenis && d[nameField] !== jenis) return false;
    if (transaksi && d.jenis_transaksi !== transaksi) return false;
    if (supplier && !String(d.supplier || "").toLowerCase().includes(supplier.toLowerCase())) return false;
    if (search) {
      const blob = [
        d[nameField], d.satuan, d.supplier, d.pic_name, d.kode,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!blob.includes(search.toLowerCase())) return false;
    }
    return true;
  });
  out.sort((a, b) =>
    `${b.date}${b.created_at || ""}`.localeCompare(`${a.date}${a.created_at || ""}`));
  return out;
}

export function stampCreate(doc, current) {
  return {
    ...doc,
    id: crypto.randomUUID(),
    created_by: current.id,
    created_by_name: current.name,
    created_at: nowIso(),
    updated_at: null,
  };
}
