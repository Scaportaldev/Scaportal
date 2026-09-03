/** Port 1:1 dari backend/stock.py — perhitungan stok kertas, tinta & barang lain. */

const num = (v) => Number(v || 0);
const round = (v, d = 2) => {
  const f = 10 ** d;
  return Math.round((Number(v) + Number.EPSILON) * f) / f;
};

export function computeHargaPerRim(mode, priceInput, gramatur, panjang, lebar, jumlah) {
  const price = num(priceInput);
  if (mode === "per_rim") return round(price, 2);
  if (mode === "per_kg") return round((num(gramatur) * num(panjang) * num(lebar) * price) / 20000, 2);
  if (mode === "total") return num(jumlah) ? round(price / num(jumlah), 2) : 0;
  return round(price, 2);
}

export function paperKey(m) {
  return `${m.jenis_kertas ?? ""}|${m.gramatur ?? ""}|${m.panjang ?? ""}|${m.lebar ?? ""}`;
}

export function signedQty(m) {
  const t = m.jenis_transaksi;
  const j = num(m.jumlah);
  if (t === "masuk") return j;
  if (t === "keluar") return -j;
  if (t === "retur") return j;
  return 0;
}

function finalize(map) {
  for (const v of Object.values(map)) {
    v.stock = round(v.stock, 3);
    v.wavg = v._masuk_qty ? round(v._masuk_val / v._masuk_qty, 2) : 0;
    v.nominal = round(Math.max(v.stock, 0) * v.wavg, 2);
  }
  return map;
}

export function computePaperStocks(mutations) {
  const result = {};
  for (const m of mutations) {
    const k = paperKey(m);
    if (!result[k]) {
      result[k] = {
        jenis_kertas: m.jenis_kertas,
        gramatur: m.gramatur,
        panjang: m.panjang,
        lebar: m.lebar,
        stock: 0,
        _masuk_qty: 0,
        _masuk_val: 0,
      };
    }
    result[k].stock += signedQty(m);
    if (m.jenis_transaksi === "masuk") {
      const q = num(m.jumlah);
      result[k]._masuk_qty += q;
      result[k]._masuk_val += q * num(m.harga_per_rim);
    }
  }
  return finalize(result);
}

export function computeInkStocks(mutations) {
  const result = {};
  for (const m of mutations) {
    const k = m.jenis_tinta ?? "";
    if (!result[k]) result[k] = { jenis_tinta: k, stock: 0, _masuk_qty: 0, _masuk_val: 0 };
    result[k].stock += signedQty(m);
    if (m.jenis_transaksi === "masuk") {
      const q = num(m.jumlah);
      result[k]._masuk_qty += q;
      result[k]._masuk_val += q * num(m.harga_per_kg);
    }
  }
  return finalize(result);
}

export function computeOtherStocks(mutations) {
  const result = {};
  for (const m of mutations) {
    const k = m.nama_barang ?? "";
    if (!result[k]) {
      result[k] = { nama_barang: k, satuan: m.satuan || "", stock: 0, _masuk_qty: 0, _masuk_val: 0 };
    }
    if (!result[k].satuan && m.satuan) result[k].satuan = m.satuan;
    result[k].stock += signedQty(m);
    if (m.jenis_transaksi === "masuk") {
      const q = num(m.jumlah);
      result[k]._masuk_qty += q;
      result[k]._masuk_val += q * num(m.harga_per_satuan);
    }
  }
  return finalize(result);
}

export function currentPaperStockForKey(mutations, jenisKertas, gramatur, panjang, lebar, excludeId = null) {
  let total = 0;
  for (const m of mutations) {
    if (excludeId && m.id === excludeId) continue;
    if (
      m.jenis_kertas === jenisKertas &&
      String(m.gramatur) === String(gramatur) &&
      String(m.panjang) === String(panjang) &&
      String(m.lebar) === String(lebar)
    ) {
      total += signedQty(m);
    }
  }
  return round(total, 3);
}

export function currentInkStockForKey(mutations, jenisTinta, excludeId = null) {
  let total = 0;
  for (const m of mutations) {
    if (excludeId && m.id === excludeId) continue;
    if (m.jenis_tinta === jenisTinta) total += signedQty(m);
  }
  return round(total, 3);
}

export function currentOtherStockForKey(mutations, namaBarang, excludeId = null) {
  let total = 0;
  for (const m of mutations) {
    if (excludeId && m.id === excludeId) continue;
    if (m.nama_barang === namaBarang) total += signedQty(m);
  }
  return round(total, 3);
}

export { round };
