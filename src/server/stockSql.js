/**
 * Agregasi stok langsung di SQL (GROUP BY) — pengganti "muat semua mutasi
 * setahun ke memori lalu hitung di JS" untuk Dashboard & Laporan Stok Ringkas.
 *
 * Semantik dijaga IDENTIK dengan stock.js:
 *  - kunci barang dibandingkan case-sensitive (COLLATE utf8mb4_bin == `===` JS),
 *  - stock  = SUM(signed qty)           -> round 3
 *  - wavg   = SUM(masuk qty*harga)/SUM(masuk qty) -> round 2 (0 bila tak ada masuk)
 *  - nominal= max(stock,0) * wavg       -> round 2
 *  - `satuan` barang lain = satuan baris terbaru; bila kosong, satuan non-kosong berikutnya.
 */
import { query, queryOne, fromRows } from "@/server/db";
import { tableFor, SIGNED_QTY_SQL } from "@/server/mutations";
import { finalize, paperKey, round } from "@/server/stock";
import { ID_MONTHS } from "@/server/format";

const KEY_COLS = {
  paper: ["jenis_kertas", "gramatur", "panjang", "lebar"],
  ink: ["jenis_tinta"],
  other: ["nama_barang"],
};
const PRICE_COL = { paper: "harga_per_rim", ink: "harga_per_kg", other: "harga_per_satuan" };
const TEXT_KEY = { paper: "jenis_kertas", ink: "jenis_tinta", other: "nama_barang" };

const bt = (c) => "`" + c + "`";
/** GROUP BY: kolom teks pakai collation binary agar 'Ivory' != 'IVORY' (seperti JS). */
const groupExpr = (type) => KEY_COLS[type].map((c) => (c === TEXT_KEY[type] ? `${bt(c)} COLLATE utf8mb4_bin` : bt(c)));

const keyOf = {
  paper: (r) => paperKey(r),
  ink: (r) => r.jenis_tinta ?? "",
  other: (r) => r.nama_barang ?? "",
};

/**
 * Peta stok per kunci barang untuk satu tahun — bentuk keluaran sama dengan
 * computePaperStocks / computeInkStocks / computeOtherStocks (sudah di-finalize).
 */
export async function aggregateStocks(type, year) {
  const table = tableFor(type);
  const price = bt(PRICE_COL[type]);
  const keySel = KEY_COLS[type].map(bt).join(",");
  // Untuk barang lain, satuan ikut di-group agar bisa dipilih persis seperti JS.
  const extraSel = type === "other" ? ", `satuan`" : "";
  const extraGrp = type === "other" ? ", `satuan` COLLATE utf8mb4_bin" : "";
  const rows = await query(
    `SELECT ${keySel}${extraSel}, ` +
    `SUM(${SIGNED_QTY_SQL}) AS stock, ` +
    "SUM(CASE WHEN `jenis_transaksi`='masuk' THEN `jumlah` ELSE 0 END) AS masuk_qty, " +
    `SUM(CASE WHEN \`jenis_transaksi\`='masuk' THEN \`jumlah\` * ${price} ELSE 0 END) AS masuk_val, ` +
    "MAX(`date`) AS last_date, MAX(`created_at`) AS last_created " +
    `FROM \`${table}\` WHERE \`year\`=? GROUP BY ${groupExpr(type).join(",")}${extraGrp}`,
    [Number(year)],
  );
  // Urutkan seperti listMutations (date DESC, created_at DESC) supaya pemilihan satuan
  // barang lain mengikuti baris terbaru, persis computeOtherStocks().
  rows.sort((a, b) => {
    if (a.last_date !== b.last_date) return a.last_date > b.last_date ? -1 : 1;
    const ac = a.last_created?.getTime?.() ?? 0, bc = b.last_created?.getTime?.() ?? 0;
    return bc - ac;
  });
  const result = {};
  for (const r of rows) {
    const k = keyOf[type](r);
    if (!result[k]) {
      const base = type === "paper"
        ? { jenis_kertas: r.jenis_kertas, gramatur: r.gramatur, panjang: r.panjang, lebar: r.lebar }
        : type === "ink" ? { jenis_tinta: k } : { nama_barang: k, satuan: r.satuan || "" };
      result[k] = { ...base, stock: 0, _masuk_qty: 0, _masuk_val: 0 };
    }
    if (type === "other" && !result[k].satuan && r.satuan) result[k].satuan = r.satuan;
    result[k].stock += Number(r.stock || 0);
    result[k]._masuk_qty += Number(r.masuk_qty || 0);
    result[k]._masuk_val += Number(r.masuk_val || 0);
  }
  return finalize(result);
}

/**
 * Stok per kunci barang per supplier: { [key]: { [supplier]: qty } }.
 * Nama supplier di-trim; kosong -> "Tanpa Supplier" (sama dengan computeStock lama).
 */
export async function aggregateStocksBySupplier(type, year) {
  const table = tableFor(type);
  const keySel = KEY_COLS[type].map(bt).join(",");
  const rows = await query(
    `SELECT ${keySel}, \`supplier\`, SUM(${SIGNED_QTY_SQL}) AS qty FROM \`${table}\` WHERE \`year\`=? ` +
    `GROUP BY ${groupExpr(type).join(",")}, \`supplier\` COLLATE utf8mb4_bin`,
    [Number(year)],
  );
  const acc = {};
  for (const r of rows) {
    const k = keyOf[type](r);
    const s = (r.supplier || "").trim() || "Tanpa Supplier";
    acc[k] = acc[k] || {};
    acc[k][s] = (acc[k][s] || 0) + Number(r.qty || 0);
  }
  return acc;
}

/** Jumlah mutasi (3 tabel) pada satu tanggal di tahun tsb — 1 query. */
export async function countMutationsOn(year, date) {
  const sub = (t) => `(SELECT COUNT(*) FROM \`${t}\` WHERE \`year\`=? AND \`date\`=?)`;
  const row = await queryOne(
    `SELECT ${sub("paper_mutations")} + ${sub("ink_mutations")} + ${sub("other_mutations")} AS n`,
    [Number(year), date, Number(year), date, Number(year), date],
  );
  return Number(row?.n || 0);
}

/**
 * Total masuk/keluar kertas & tinta per bulan (1 query) untuk tren.
 * months: array [yy, mm]. Hanya baris tahun `year` (perilaku lama: allYear(year)).
 */
export async function monthlyTrend(year, months) {
  const rows = await query(
    "SELECT 'paper' AS t, DATE_FORMAT(`date`,'%Y-%m') AS ym, `jenis_transaksi` AS trx, SUM(`jumlah`) AS s " +
    "FROM `paper_mutations` WHERE `year`=? GROUP BY ym, trx " +
    "UNION ALL " +
    "SELECT 'ink' AS t, DATE_FORMAT(`date`,'%Y-%m') AS ym, `jenis_transaksi` AS trx, SUM(`jumlah`) AS s " +
    "FROM `ink_mutations` WHERE `year`=? GROUP BY ym, trx",
    [Number(year), Number(year)],
  );
  const idx = {};
  for (const r of rows) idx[`${r.t}|${r.ym}|${r.trx}`] = Number(r.s || 0);
  const pad = (n) => String(n).padStart(2, "0");
  return months.map(([yy, mm]) => {
    const ym = `${yy}-${pad(mm)}`;
    const g = (t, trx) => idx[`${t}|${ym}|${trx}`] || 0;
    return {
      label: ID_MONTHS[mm - 1].slice(0, 3),
      paper_masuk: round(g("paper", "masuk"), 2),
      paper_keluar: round(g("paper", "keluar"), 2),
      ink_masuk: round(g("ink", "masuk"), 2),
      ink_keluar: round(g("ink", "keluar"), 2),
    };
  });
}

/**
 * N mutasi terbaru lintas 3 tabel (1 query UNION ALL, ORDER BY date DESC, created_at DESC LIMIT n)
 * — bentuk baris sama dengan `combined` di computeDashboard lama (kategori, satuan, nama).
 */
export async function recentMutations(year, n = 10) {
  const base = "`id`,`date`,`year`,`kode`,`jenis_transaksi`,`jumlah`,`supplier`,`pic_name`,`ppn_ada`,`ppn_nominal`," +
    "`ref_mutation_id`,`created_by`,`created_by_name`,`created_at`,`updated_at`";
  const rows = await query(
    `SELECT ${base}, 'Kertas' AS kategori, 'Rim' AS satuan, \`jenis_kertas\` AS nama, \`jenis_kertas\`, NULL AS jenis_tinta, NULL AS nama_barang FROM \`paper_mutations\` WHERE \`year\`=? ` +
    "UNION ALL " +
    `SELECT ${base}, 'Tinta', 'Kg', \`jenis_tinta\`, NULL, \`jenis_tinta\`, NULL FROM \`ink_mutations\` WHERE \`year\`=? ` +
    "UNION ALL " +
    `SELECT ${base}, 'Lain', IF(\`satuan\`='', 'unit', \`satuan\`), \`nama_barang\`, NULL, NULL, \`nama_barang\` FROM \`other_mutations\` WHERE \`year\`=? ` +
    "ORDER BY `date` DESC, `created_at` DESC LIMIT ?",
    [Number(year), Number(year), Number(year), Number(n)],
  );
  return fromRows(rows, { bools: ["ppn_ada"] });
}
