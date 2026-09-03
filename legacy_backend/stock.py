"""Stock computation helpers for paper and ink mutations."""


def compute_harga_per_rim(mode, price_input, gramatur, panjang, lebar, jumlah):
    price_input = float(price_input or 0)
    if mode == "per_rim":
        return round(price_input, 2)
    if mode == "per_kg":
        return round((float(gramatur) * float(panjang) * float(lebar) * price_input) / 20000.0, 2)
    if mode == "total":
        return round(price_input / float(jumlah), 2) if jumlah else 0.0
    return round(price_input, 2)


def paper_key(m):
    return f"{m.get('jenis_kertas','')}|{m.get('gramatur','')}|{m.get('panjang','')}|{m.get('lebar','')}"


def signed_qty(m):
    t = m.get("jenis_transaksi")
    j = float(m.get("jumlah", 0) or 0)
    if t == "masuk":
        return j
    if t == "keluar":
        return -j
    if t == "retur":
        return j
    return 0


def compute_paper_stocks(mutations):
    """Return dict key -> {meta + stock + wavg + nominal}."""
    result = {}
    for m in mutations:
        k = paper_key(m)
        if k not in result:
            result[k] = {
                "jenis_kertas": m.get("jenis_kertas"),
                "gramatur": m.get("gramatur"),
                "panjang": m.get("panjang"),
                "lebar": m.get("lebar"),
                "stock": 0.0,
                "_masuk_qty": 0.0,
                "_masuk_val": 0.0,
            }
        result[k]["stock"] += signed_qty(m)
        if m.get("jenis_transaksi") == "masuk":
            q = float(m.get("jumlah", 0) or 0)
            result[k]["_masuk_qty"] += q
            result[k]["_masuk_val"] += q * float(m.get("harga_per_rim", 0) or 0)
    for k, v in result.items():
        v["stock"] = round(v["stock"], 3)
        v["wavg"] = round(v["_masuk_val"] / v["_masuk_qty"], 2) if v["_masuk_qty"] else 0.0
        v["nominal"] = round(max(v["stock"], 0) * v["wavg"], 2)
    return result


def compute_ink_stocks(mutations):
    result = {}
    for m in mutations:
        k = m.get("jenis_tinta", "")
        if k not in result:
            result[k] = {"jenis_tinta": k, "stock": 0.0, "_masuk_qty": 0.0, "_masuk_val": 0.0}
        result[k]["stock"] += signed_qty(m)
        if m.get("jenis_transaksi") == "masuk":
            q = float(m.get("jumlah", 0) or 0)
            result[k]["_masuk_qty"] += q
            result[k]["_masuk_val"] += q * float(m.get("harga_per_kg", 0) or 0)
    for k, v in result.items():
        v["stock"] = round(v["stock"], 3)
        v["wavg"] = round(v["_masuk_val"] / v["_masuk_qty"], 2) if v["_masuk_qty"] else 0.0
        v["nominal"] = round(max(v["stock"], 0) * v["wavg"], 2)
    return result


def current_paper_stock_for_key(mutations, jenis_kertas, gramatur, panjang, lebar, exclude_id=None):
    total = 0.0
    for m in mutations:
        if exclude_id and m.get("id") == exclude_id:
            continue
        if (m.get("jenis_kertas") == jenis_kertas and str(m.get("gramatur")) == str(gramatur)
                and str(m.get("panjang")) == str(panjang) and str(m.get("lebar")) == str(lebar)):
            total += signed_qty(m)
    return round(total, 3)


def current_ink_stock_for_key(mutations, jenis_tinta, exclude_id=None):
    total = 0.0
    for m in mutations:
        if exclude_id and m.get("id") == exclude_id:
            continue
        if m.get("jenis_tinta") == jenis_tinta:
            total += signed_qty(m)
    return round(total, 3)


def compute_other_stocks(mutations):
    result = {}
    for m in mutations:
        k = m.get("nama_barang", "")
        if k not in result:
            result[k] = {"nama_barang": k, "satuan": (m.get("satuan") or ""), "stock": 0.0,
                         "_masuk_qty": 0.0, "_masuk_val": 0.0}
        if not result[k]["satuan"] and m.get("satuan"):
            result[k]["satuan"] = m.get("satuan")
        result[k]["stock"] += signed_qty(m)
        if m.get("jenis_transaksi") == "masuk":
            q = float(m.get("jumlah", 0) or 0)
            result[k]["_masuk_qty"] += q
            result[k]["_masuk_val"] += q * float(m.get("harga_per_satuan", 0) or 0)
    for k, v in result.items():
        v["stock"] = round(v["stock"], 3)
        v["wavg"] = round(v["_masuk_val"] / v["_masuk_qty"], 2) if v["_masuk_qty"] else 0.0
        v["nominal"] = round(max(v["stock"], 0) * v["wavg"], 2)
    return result


def current_other_stock_for_key(mutations, nama_barang, exclude_id=None):
    total = 0.0
    for m in mutations:
        if exclude_id and m.get("id") == exclude_id:
            continue
        if m.get("nama_barang") == nama_barang:
            total += signed_qty(m)
    return round(total, 3)
