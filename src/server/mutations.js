/**
 * Mutasi Stok SCA (kertas / tinta / barang lain) — validasi + akses tabel.
 * Tabel: paper_mutations, ink_mutations, other_mutations.
 */
import {
  query, queryOne, insertRow, updateRow, deleteRows, fromRow, fromRows,
  toDateTime, toDate, nowIso, todayStr, q, likeContains,
} from "@/server/db";
import { HttpError } from "@/server/http";
import { computeHargaPerRim, round } from "@/server/stock";
import { cached, invalidate, TAG_STOK } from "@/server/cache";

export const TYPES = ["paper", "ink", "other"];

export const TABLE_BY_TYPE = {
  paper: "paper_mutations",
  ink: "ink_mutations",
  other: "other_mutations",
};

export function tableFor(type) {
  const t = TABLE_BY_TYPE[type];
  if (!t) throw new HttpError(404, "Jenis mutasi tidak dikenal");
  return t;
}

export const NAME_FIELD = { paper: "jenis_kertas", ink: "jenis_tinta", other: "nama_barang" };

const BASE_COLS = [
  "id", "date", "year", "kode", "jenis_transaksi", "jumlah", "supplier", "pic_name",
  "ppn_ada", "ppn_nominal", "ref_mutation_id", "created_by", "created_by_name", "created_at", "updated_at",
];
const TYPE_COLS = {
  paper: ["jenis_kertas", "gramatur", "panjang", "lebar", "price_mode", "price_input", "harga_per_rim"],
  ink: ["jenis_tinta", "harga_per_kg"],
  other: ["nama_barang", "satuan", "harga_per_satuan"],
};
const SPEC = { bools: ["ppn_ada"] };

/**
 * Kuantitas bertanda dalam SQL — cermin persis signedQty() di stock.js:
 * masuk +jumlah, retur +jumlah, keluar -jumlah, lainnya 0.
 */
export const SIGNED_QTY_SQL =
  "CASE `jenis_transaksi` WHEN 'masuk' THEN `jumlah` WHEN 'retur' THEN `jumlah` WHEN 'keluar' THEN -`jumlah` ELSE 0 END";

/** Pilih hanya kolom yang ada di tabel + konversi tipe untuk SQL. */
export function toRow(type, doc) {
  const cols = [...BASE_COLS, ...TYPE_COLS[type]];
  const row = {};
  for (const c of cols) {
    if (doc[c] === undefined) continue;
    let v = doc[c];
    if (c === "date") v = toDate(v);
    else if (c === "created_at" || c === "updated_at") v = toDateTime(v);
    else if (c === "ppn_ada") v = v ? 1 : 0;
    row[c] = v;
  }
  return row;
}

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
    const mode = ["per_rim", "per_kg", "total"].includes(data.price_mode) ? data.price_mode : "per_rim";
    return {
      ...base,
      jenis_kertas: str(data.jenis_kertas),
      gramatur, panjang, lebar,
      price_mode: isMasuk ? mode : null,
      price_input: isMasuk ? num(data.price_input) : null,
      harga_per_rim: isMasuk
        ? computeHargaPerRim(mode, data.price_input, gramatur, panjang, lebar, jumlah)
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

// ---------------- Akses tabel ----------------

/** Semua mutasi (opsional filter tahun). */
export async function listMutations(type, { year } = {}) {
  const table = tableFor(type);
  const rows = year
    ? await query(`SELECT * FROM ${q(table)} WHERE \`year\`=? ORDER BY \`date\` DESC, \`created_at\` DESC`, [Number(year)])
    : await query(`SELECT * FROM ${q(table)} ORDER BY \`date\` DESC, \`created_at\` DESC`);
  return fromRows(rows, SPEC);
}

/**
 * Susun klausa WHERE dari filter daftar — semantik identik dengan filterRows():
 * start/end inklusif, jenis exact (binary/case-sensitive seperti `===`),
 * transaksi exact, supplier "mengandung" (case-insensitive), search "mengandung"
 * pada nama / satuan(other) / supplier / PIC / kode (case-insensitive).
 */
function buildWhere(type, { year, start, end, jenis, transaksi, supplier, search } = {}) {
  const nameCol = q(NAME_FIELD[type]);
  const where = [];
  const params = [];
  if (year) { where.push("`year`=?"); params.push(Number(year)); }
  if (start) { where.push("`date`>=?"); params.push(String(start)); }
  if (end) { where.push("`date`<=?"); params.push(String(end)); }
  if (jenis) { where.push(`${nameCol} COLLATE utf8mb4_bin = ?`); params.push(String(jenis)); }
  if (transaksi) { where.push("`jenis_transaksi`=?"); params.push(String(transaksi)); }
  if (supplier) { where.push("`supplier` LIKE ?"); params.push(likeContains(supplier)); }
  if (search) {
    const s = likeContains(search);
    const cols = [nameCol, ...(type === "other" ? ["`satuan`"] : []), "`supplier`", "`pic_name`", "`kode`"];
    where.push(`(${cols.map((c) => `${c} LIKE ?`).join(" OR ")})`);
    for (let i = 0; i < cols.length; i++) params.push(s);
  }
  return { sql: where.length ? ` WHERE ${where.join(" AND ")}` : "", params };
}

/**
 * Daftar mutasi dengan filter di SQL (+ pagination opsional).
 * Mengembalikan { items, total }. Tanpa `pg` -> semua baris yang cocok.
 */
export async function queryMutations(type, filters = {}, pg = null) {
  const table = tableFor(type);
  const { sql: where, params } = buildWhere(type, filters);
  const order = " ORDER BY `date` DESC, `created_at` DESC";
  if (!pg) {
    const rows = await query(`SELECT * FROM ${q(table)}${where}${order}`, params);
    return { items: fromRows(rows, SPEC), total: rows.length };
  }
  const [rows, cnt] = await Promise.all([
    query(`SELECT * FROM ${q(table)}${where}${order} LIMIT ? OFFSET ?`, [...params, Number(pg.pageSize), Number(pg.offset)]),
    queryOne(`SELECT COUNT(*) AS n FROM ${q(table)}${where}`, params),
  ]);
  return { items: fromRows(rows, SPEC), total: Number(cnt?.n || 0) };
}

/**
 * Opsi referensi untuk form (dropdown "Referensi Mutasi Keluar" / "Ambil Kode dari Mutasi Masuk").
 * Hanya kolom yang ditampilkan di label + identitas barang untuk auto-isi.
 */
export async function refOptions(type, { year, transaksi, limit = 1000 } = {}) {
  return await cached(TAG_STOK, `refs:${type}:${year ?? ""}:${transaksi ?? ""}:${limit}`, () => refOptionsUncached(type, { year, transaksi, limit }));
}

async function refOptionsUncached(type, { year, transaksi, limit }) {
  const table = tableFor(type);
  const extra = {
    paper: "`jenis_kertas`,`gramatur`,`panjang`,`lebar`",
    ink: "`jenis_tinta`",
    other: "`nama_barang`,`satuan`",
  }[type];
  const where = [];
  const params = [];
  if (year) { where.push("`year`=?"); params.push(Number(year)); }
  if (transaksi) { where.push("`jenis_transaksi`=?"); params.push(String(transaksi)); }
  const sql = `SELECT \`id\`,\`kode\`,\`date\`,\`jenis_transaksi\`,\`jumlah\`,${extra} FROM ${q(table)}` +
    `${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY \`date\` DESC, \`created_at\` DESC LIMIT ?`;
  params.push(Number(limit));
  return fromRows(await query(sql, params));
}

export async function getMutation(type, id) {
  const table = tableFor(type);
  return fromRow(await queryOne(`SELECT * FROM ${q(table)} WHERE \`id\`=?`, [id]), SPEC);
}

// Setiap tulis membatalkan cache agregat (dashboard, laporan, jenis, refs).
export async function insertMutation(type, doc) {
  await insertRow(tableFor(type), toRow(type, doc));
  invalidate(TAG_STOK);
  return doc;
}

export async function updateMutation(type, id, doc) {
  const res = await updateRow(tableFor(type), toRow(type, doc), { id });
  invalidate(TAG_STOK);
  return res;
}

export async function deleteMutation(type, id) {
  const res = await deleteRows(tableFor(type), { id });
  invalidate(TAG_STOK);
  return res;
}

/** Hapus semua mutasi (tutup tahun). Mengembalikan jumlah baris terhapus. */
export async function deleteAllMutations(type) {
  const res = await deleteRows(tableFor(type), {});
  invalidate(TAG_STOK);
  return res.affectedRows;
}

/** Daftar nama unik (jenis kertas / jenis tinta / nama barang) — di-cache. */
export async function distinctNames(type) {
  return await cached(TAG_STOK, `jenis:${type}`, () => distinctNamesUncached(type));
}

async function distinctNamesUncached(type) {
  const table = tableFor(type);
  const col = NAME_FIELD[type];
  const rows = await query(`SELECT DISTINCT ${q(col)} AS v FROM ${q(table)} WHERE ${q(col)} <> '' ORDER BY ${q(col)} ASC`);
  return rows.map((r) => r.v).filter(Boolean);
}

/**
 * Stok saat ini untuk satu kunci barang, dihitung di SQL (SUM kuantitas bertanda).
 * Cermin persis currentPaperStockForKey / currentInkStockForKey / currentOtherStockForKey:
 * - nama dibandingkan exact & case-sensitive (COLLATE utf8mb4_bin  ==  `===` di JS),
 * - gramatur/panjang/lebar dibandingkan sebagai angka,
 * - `excludeId` dikecualikan (saat edit),
 * - hasil dibulatkan 3 desimal.
 */
export async function currentStockSql(type, doc, excludeId = null) {
  const table = tableFor(type);
  const where = ["`year`=?"];
  const params = [Number(doc.year)];
  if (type === "paper") {
    where.push("`jenis_kertas` COLLATE utf8mb4_bin = ?", "`gramatur`=?", "`panjang`=?", "`lebar`=?");
    params.push(String(doc.jenis_kertas), num(doc.gramatur), num(doc.panjang), num(doc.lebar));
  } else if (type === "ink") {
    where.push("`jenis_tinta` COLLATE utf8mb4_bin = ?");
    params.push(String(doc.jenis_tinta));
  } else {
    where.push("`nama_barang` COLLATE utf8mb4_bin = ?");
    params.push(String(doc.nama_barang));
  }
  if (excludeId) { where.push("`id`<>?"); params.push(excludeId); }
  const row = await queryOne(
    `SELECT COALESCE(SUM(${SIGNED_QTY_SQL}),0) AS stock FROM ${q(table)} WHERE ${where.join(" AND ")}`,
    params,
  );
  return round(Number(row?.stock || 0), 3);
}

/** Validasi stok untuk transaksi Keluar (1 query agregat, bukan memuat semua mutasi). */
export async function assertStockAvailable(type, doc, excludeId = null) {
  if (doc.jenis_transaksi !== "keluar") return;
  const avail = await currentStockSql(type, doc, excludeId);
  const unit = type === "paper" ? "Rim" : type === "ink" ? "Kg" : (doc.satuan || "unit");
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
