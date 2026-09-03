"""
Seed DATA DUMMY untuk demo LAPORAN STOK SCA (Stok + PO Tracker + HPP).

Data ditulis ke MongoDB Atlas melalui API aplikasi (endpoint resmi), sehingga
kode mutasi, perhitungan harga/PPN, log aktivitas, dan status PO ikut terbentuk
persis seperti input manual.

Pakai:
    python3 tests/seed_dummy.py          # tambah data dummy
    python3 tests/seed_dummy.py --wipe   # hapus SEMUA data dummy buatan script ini

Penanda data dummy:
  - Mutasi  : supplier ada di DUMMY_SUPPLIERS / nama barang di DUMMY_OTHER
  - PO      : nomor PO diawali "SCA-"
  - HPP     : nama perhitungan diawali "[DEMO]"
"""

import json
import os
import random
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8001/api"
IDS_FILE = "/app/tests/.seed_ids.json"
# Kredensial diambil dari environment (jangan hardcode di repo).
LOGIN = {
    "username": os.environ.get("SUPERADMIN_USERNAME", "admin"),
    "password": os.environ.get("SUPERADMIN_PASSWORD", ""),
    "role": "superadmin",
}

random.seed(7)

DUMMY_SUPPLIERS = [
    "PT.PAPYRUS PRIMA", "PT.INDAH KIAT PULP", "CV.KERTAS MAKMUR",
    "PT.TJIWI KIMIA", "CV.SUMBER RIZKI PAPER",
    "PT.TINTA NUSANTARA", "CV.WARNA CEMERLANG", "PT.SAKATA INX",
    "CV.ANEKA PACKING", "PT.MITRA PLASTIK",
]

PAPER_JENIS = [
    # (jenis, gramatur, panjang, lebar, harga per rim)
    ("IVORY", 250, 65, 100, 1_050_000),
    ("IVORY", 310, 79, 109, 1_480_000),
    ("DUPLEX COAT", 350, 79, 109, 1_150_000),
    ("ART PAPER", 120, 65, 100, 780_000),
    ("ART CARTON", 230, 65, 100, 960_000),
    ("HVS", 70, 65, 100, 610_000),
    ("HVS", 80, 79, 109, 720_000),
    ("SAMSON KRAFT", 220, 79, 109, 690_000),
]

INK_JENIS = [
    ("CYAN", 185_000), ("MAGENTA", 190_000), ("YELLOW", 182_000),
    ("BLACK", 165_000), ("PANTONE 072C", 320_000), ("VARNISH GLOSSY", 145_000),
]

DUMMY_OTHER = [
    ("Lem Bottom", "Kg", 48_000), ("Plastik OPP 40mic", "Roll", 165_000),
    ("Kawat Jahit Galvanis", "Box", 92_000), ("Selotip Bening 2 inch", "Pcs", 12_500),
    ("Pallet Kayu 100x120", "Pcs", 145_000), ("Tali Rafia", "Kg", 28_000),
]

MONTHS = [(2026, m) for m in range(1, 9)]
PICS = ["Jeff (Superadmin)"]


def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except Exception:
            return e.code, {"detail": raw[:200].decode(errors="ignore")}


CREATED = {"paper": [], "ink": [], "other": [], "pos": [], "hpp": []}


def remember(kind, doc_id):
    if doc_id:
        CREATED[kind].append(doc_id)


def save_ids():
    try:
        old = json.load(open(IDS_FILE))
    except Exception:
        old = {}
    for k, v in CREATED.items():
        old[k] = list(dict.fromkeys((old.get(k) or []) + v))
    json.dump(old, open(IDS_FILE, "w"), indent=1)
    print(f"\nID data dummy disimpan di {IDS_FILE} (untuk --wipe presisi)")


def login():
    st, r = req("POST", "/auth/login", body=LOGIN)
    if st != 200:
        print("Gagal login:", st, r)
        sys.exit(1)
    return r["token"]


def d(year, month, day):
    return f"{year}-{month:02d}-{day:02d}"


# ---------------------------------------------------------------- MUTASI STOK
def seed_paper(token):
    ok = 0
    stock, origin = {}, {}
    for (year, month) in MONTHS:
        for jenis, gram, p, l, harga in random.sample(PAPER_JENIS, k=random.randint(3, 5)):
            key = (jenis, gram, p, l)
            qty = random.choice([50, 75, 100, 120, 150, 200])
            sup = random.choice(DUMMY_SUPPLIERS[:5])
            mode = random.choice(["per_rim", "per_rim", "per_kg", "total"])
            price = {
                "per_rim": harga,
                "per_kg": random.choice([19_000, 21_500, 23_000, 24_500]),  # Rp/kg realistis
                "total": harga * qty,
            }[mode]
            ppn = random.random() < 0.55
            st, r = req("POST", "/paper/mutations", token, {
                "date": d(year, month, random.randint(2, 26)),
                "kode": jenis[:3].upper(),
                "jenis_transaksi": "masuk",
                "jenis_kertas": jenis, "gramatur": gram, "panjang": p, "lebar": l,
                "jumlah": qty, "supplier": sup, "pic_name": random.choice(PICS),
                "price_mode": mode, "price_input": price,
                "ppn_ada": ppn, "ppn_nominal": round(harga * qty * 0.11) if ppn else 0,
            })
            if st == 200:
                ok += 1
                remember("paper", r.get("id"))
                stock[key] = stock.get(key, 0) + qty
                origin[key] = sup
            else:
                print("  paper masuk gagal:", st, r)

        # Keluar (produksi) — maksimal 60% stok tersedia
        for key, avail in list(stock.items()):
            if avail <= 10 or random.random() < 0.35:
                continue
            jenis, gram, p, l = key
            out = max(5, int(avail * random.uniform(0.15, 0.45)))
            st, r = req("POST", "/paper/mutations", token, {
                "date": d(year, month, random.randint(5, 28)),
                "kode": jenis[:3].upper(),
                "jenis_transaksi": "keluar",
                "jenis_kertas": jenis, "gramatur": gram, "panjang": p, "lebar": l,
                "jumlah": out, "supplier": origin.get(key, ""), "pic_name": random.choice(PICS),
            })
            if st == 200:
                ok += 1
                remember("paper", r.get("id"))
                stock[key] = avail - out
            else:
                print("  paper keluar gagal:", st, r.get("detail"))
    return ok


def seed_ink(token):
    ok, stock, origin = 0, {}, {}
    for (year, month) in MONTHS:
        for jenis, harga in random.sample(INK_JENIS, k=random.randint(2, 4)):
            qty = random.choice([10, 15, 20, 25, 30])
            ppn = random.random() < 0.5
            st, r = req("POST", "/ink/mutations", token, {
                "date": d(year, month, random.randint(2, 25)),
                "kode": jenis[:3].upper(),
                "jenis_transaksi": "masuk",
                "jenis_tinta": jenis, "jumlah": qty,
                "supplier": random.choice(DUMMY_SUPPLIERS[5:8]),
                "pic_name": random.choice(PICS),
                "harga_per_kg": harga,
                "ppn_ada": ppn, "ppn_nominal": round(harga * qty * 0.11) if ppn else 0,
            })
            if st == 200:
                ok += 1
                remember("ink", r.get("id"))
                stock[jenis] = stock.get(jenis, 0) + qty
                origin[jenis] = r.get("supplier") or ""
            else:
                print("  ink masuk gagal:", st, r)
        for jenis, avail in list(stock.items()):
            if avail <= 4 or random.random() < 0.4:
                continue
            out = max(2, int(avail * random.uniform(0.2, 0.5)))
            st, r = req("POST", "/ink/mutations", token, {
                "date": d(year, month, random.randint(6, 28)),
                "kode": jenis[:3].upper(),
                "jenis_transaksi": "keluar",
                "jenis_tinta": jenis, "jumlah": out,
                "supplier": origin.get(jenis, ""), "pic_name": random.choice(PICS),
            })
            if st == 200:
                ok += 1
                remember("ink", r.get("id"))
                stock[jenis] = avail - out
            else:
                print("  ink keluar gagal:", st, r.get("detail"))
    return ok


def seed_other(token):
    ok, stock, origin = 0, {}, {}
    for (year, month) in MONTHS:
        for nama, satuan, harga in random.sample(DUMMY_OTHER, k=random.randint(2, 4)):
            qty = random.choice([12, 20, 24, 40, 60])
            ppn = random.random() < 0.4
            st, r = req("POST", "/other/mutations", token, {
                "date": d(year, month, random.randint(3, 24)),
                "kode": nama[:3].upper(),
                "jenis_transaksi": "masuk",
                "nama_barang": nama, "satuan": satuan, "jumlah": qty,
                "supplier": random.choice(DUMMY_SUPPLIERS[8:]),
                "pic_name": random.choice(PICS),
                "harga_per_satuan": harga,
                "ppn_ada": ppn, "ppn_nominal": round(harga * qty * 0.11) if ppn else 0,
            })
            if st == 200:
                ok += 1
                remember("other", r.get("id"))
                stock[(nama, satuan)] = stock.get((nama, satuan), 0) + qty
                origin[(nama, satuan)] = r.get("supplier") or ""
            else:
                print("  other masuk gagal:", st, r)
        for (nama, satuan), avail in list(stock.items()):
            if avail <= 5 or random.random() < 0.45:
                continue
            out = max(2, int(avail * random.uniform(0.2, 0.5)))
            st, r = req("POST", "/other/mutations", token, {
                "date": d(year, month, random.randint(7, 28)),
                "kode": nama[:3].upper(),
                "jenis_transaksi": "keluar",
                "nama_barang": nama, "satuan": satuan, "jumlah": out,
                "supplier": origin.get((nama, satuan), ""), "pic_name": random.choice(PICS),
            })
            if st == 200:
                ok += 1
                remember("other", r.get("id"))
                stock[(nama, satuan)] = avail - out
            else:
                print("  other keluar gagal:", st, r.get("detail"))
    return ok


# ------------------------------------------------------------------ PO TRACKER
PO_CLIENTS = [
    ("PT.SIDO MUNCUL", "Box Jamu", "Ivory 250gr", "65x100"),
    ("PT.WINGS SURYA", "Karton Sabun", "Duplex 350gr", "79x109"),
    ("CV.ROTI MANIS", "Dus Roti", "Ivory 310gr", "79x109"),
    ("PT.KALBE FARMA", "Box Obat", "Art Carton 230gr", "65x100"),
    ("PT.INDOFOOD CBP", "Karton Mie", "Samson Kraft 220gr", "79x109"),
    ("CV.KOPI NUSANTARA", "Box Kopi", "Ivory 250gr", "65x100"),
    ("PT.UNILEVER IDN", "Sleeve Shampo", "Art Paper 120gr", "65x100"),
    ("CV.SNACK JAYA", "Dus Snack", "Duplex 350gr", "79x109"),
    ("PT.PARAGON TECH", "Box Kosmetik", "Ivory 310gr", "79x109"),
    ("CV.HERBAL SEHAT", "Box Herbal", "Art Carton 230gr", "65x100"),
    ("PT.MAYORA INDAH", "Karton Biskuit", "Duplex 350gr", "79x109"),
    ("CV.PERCETAKAN MITRA", "Brosur Lipat", "Art Paper 120gr", "65x100"),
]

# Skenario progres: (jumlah tahap yang diselesaikan, aksi pengiriman)
PO_PLAN = [
    (0, None),                     # baru dibuat, menunggu kertas datang
    (1, None),                     # menunggu tinta
    (2, None),                     # menunggu pesanan pisau plong
    (4, None),                     # proses cetak
    (6, None),                     # proses plong
    (8, None),                     # proses sortir
    (10, "schedule"),              # selesai cetak + jadwal kirim (belum dikirim)
    (10, "failed"),                # pengiriman GAGAL
    (10, "reschedule-success"),    # gagal -> jadwal ulang -> BERHASIL
    (10, "success"),               # selesai / completed
    (10, "success"),               # selesai / completed
    (3, None),                     # proses potong kertas
]

STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]


def stage_payload(num):
    """Data minimal agar tahap dianggap selesai (lihat src/server/po/stages.js)."""
    if num == 1:
        return {"paper_arrived": True, "needs_single_face": False}
    if num in (2, 3):
        return {"arrived": True}
    if num == 6:
        return {"finishing": random.sample(
            ["laminasi_glossy", "laminasi_doff", "uv_spot", "emboss", "hot_print"], k=2), "done": True}
    return {"done": True}


def seed_pos(token):
    created, done = 0, 0
    for i, (client, item, material, size) in enumerate(PO_CLIENTS):
        month = (i % 8) + 1
        steps, delivery = PO_PLAN[i]
        st, po = req("POST", "/po/pos", token, {
            "po_number": f"SCA-{2026}{month:02d}-{100 + i}",
            "client_name": client,
            "item_type": item, "material": material, "paper_size": size,
            "quantity": str(random.choice([3000, 5000, 8000, 12000, 20000])),
            "po_date": d(2026, month, random.randint(1, 10)),
            "est_start": d(2026, month, random.randint(11, 15)),
            "est_end": d(2026, month, random.randint(20, 27)),
            "print_machine": random.choice(["OLIVER 58", "KOMORI EXCELL", "SM 74", "GTO 52"]),
            "enabled_stages": STAGES,
            "notes": "Data demo untuk peragaan aplikasi.",
        })
        if st != 200:
            print("  PO gagal:", st, po)
            continue
        created += 1
        pid = po["id"]
        remember("pos", pid)

        for n in STAGES[:steps]:
            st, _ = req("POST", f"/po/pos/{pid}/stages/{n}", token, {"data": stage_payload(n)})
            if st == 200:
                done += 1

        if delivery and delivery.strip():
            req("POST", f"/po/pos/{pid}/stages/11", token, {"data": {"print_completed": True}})
            sched = d(2026, month, 28)
            req("POST", f"/po/pos/{pid}/delivery/schedule", token,
                {"scheduled_date": sched, "driver_name": random.choice(["Budi", "Andi", "Slamet", "Rudi"])})
            if delivery == "failed":
                req("POST", f"/po/pos/{pid}/delivery/result", token,
                    {"status": "failed", "failure_reason": "Gudang klien tutup, kirim ulang"})
            elif delivery == "reschedule-success":
                req("POST", f"/po/pos/{pid}/delivery/result", token,
                    {"status": "failed", "failure_reason": "Alamat tidak ditemukan"})
                req("POST", f"/po/pos/{pid}/delivery/schedule", token,
                    {"scheduled_date": d(2026, month + 1 if month < 12 else 12, 3), "driver_name": "Andi"})
                req("POST", f"/po/pos/{pid}/delivery/result", token, {"status": "success"})
            elif delivery == "success":
                req("POST", f"/po/pos/{pid}/delivery/result", token, {"status": "success"})

        # Jadwal kalender untuk beberapa tahap
        for n in random.sample([2, 4, 5, 7, 9, 10], k=2):
            req("POST", "/po/schedules", token, {
                "po_id": pid, "stage_number": n,
                "date": d(2026, month, random.randint(12, 26)),
                "note": "Jadwal demo",
            })
    return created, done


# ------------------------------------------------------------------------ HPP
def hpp_inputs(qty, laba, bahan, gram):
    return {
        "kertas": {"bahan": bahan, "bahanCustom": "", "gramatur": gram, "ukuran": "65 x 100 cm",
                   "customHargaKg": "0", "customPembagi": "20000", "customIndeks": "0", "customMetode": "1",
                   "qtyOrder": str(qty), "qtyPerPlano": "8", "wes": "0.07"},
        "warna": {"harga": "100", "qtyWarna": "4", "qtyPerLembar": "8"},
        "ongkosCetak": {"bahan": bahan.lower(), "gramatur": gram, "ukuranPlano": "90 x 120",
                        "ukuranLembarP": "72.1", "ukuranLembarL": "30", "qtyWarna": "4",
                        "qtyOrder": str(qty), "qtyPerLembar": "4",
                        "percetakan": "PERCETAKAN  (ASING)", "mesin": "OLIVER 58 / 44 X 58 cm ",
                        "ukuranMax": "42,9 x 56,5 cm", "gramaturMax": "350 gr",
                        "minLembar": "2500", "hargaOngkos": "525000", "hargaSetelahMin": "55", "mesinCustom": ""},
        "design": {"nama": "", "jasaDesign": "150000", "qtyOrder": str(qty)},
        "ctp": {"mesin": "KOMORI EXCELL", "mesinCustom": "", "ukuranP": "830", "ukuranL": "645",
                "biayaCTP": "50000", "qtyWarna": "4", "qtyOrder": str(qty)},
        "finishing": {"jenis": "UV", "ukuranP": "54", "ukuranL": "61.7", "hargaPerCm": "0.07", "qtyPerLembar": "8"},
        "laminasi": {"jenis": "E Flute", "ukuranP": "50", "ukuranL": "70", "hargaIndex": "3050", "perPcs": "2", "wes": "0.05"},
        "lem": {"jenis": "Lem Bottom", "jenisCustom": "", "spotP": "26.7", "spotL": "1.5", "biaya": "0", "wes": "0.06"},
        "pisauPapan": {"pisauBiaya": "450", "pisauUkuran": "38", "pisauQtyLembar": "8", "pisauQtyOrder": str(qty),
                       "papanBiaya": "18", "papanLembarP": "62", "papanLembarL": "87", "papanLebihan": "3", "papanQtyOrder": "6000"},
        "plong": {"ukuranP": "66", "ukuranL": "92", "sistem": "Borongan",
                  "jenisLaminasi": "Laminasi Glossy PE", "biayaLbr": "0", "qtyPerLembar": "8"},
        "ongkosPlong": {"ukuranMesinP": "58", "ukuranMesinL": "75", "minLembarPlong": "2000",
                        "biayaMinimum": "250000", "biayaSetelahMin": "80", "ukuranLembarP": "55",
                        "ukuranLembarL": "73", "qtyPerLembar": "10", "qtyOrder": str(qty)},
        "other": {"lokasi": "Surabaya", "biayaTranspor": "80000", "qtyOrderT": str(qty),
                  "biayaPaking": "100000", "qtyHari": "1000", "biayaPotongRim": "5000",
                  "qtyLembarPlano": "1050", "qtyOrderP": str(qty), "biayaKopekLbr": "5",
                  "qtyPcsLbr": "4", "biayaRajangRim": "10000", "qtyLembarRajang": "1050", "qtyOrderR": str(qty)},
        "ukArea": {"bahan": "Duplex Coat", "planoP": "90", "planoL": "120", "cetakP": "69", "cetakL": "58.5",
                   "kresP": "2", "kresL": "1.4", "anlegP": "1.4", "sf": "0.5", "arahSerat": "P"},
        "total": {"labaPct": str(laba), "bungaPct": "1", "ppnPct": "11"},
        "enabled": {"kertas": True, "warna": True, "ongkosCetak": True, "design": True, "ctp": True,
                    "finishing": True, "laminasi": False, "lem": True, "pisauPlong": True,
                    "papanPlong": True, "plong": True, "ongkosPlong": True, "other": True},
    }


HPP_ITEMS = [
    ("[DEMO] Box Jamu 5rb pcs", "PT.SIDO MUNCUL", 5000, 15, "Ivory", "250 Gr"),
    ("[DEMO] Karton Sabun 12rb", "PT.WINGS SURYA", 12000, 12, "Duplex Coat", "350 Gr"),
    ("[DEMO] Dus Roti 8rb pcs", "CV.ROTI MANIS", 8000, 18, "Ivory", "310 Gr"),
    ("[DEMO] Box Obat 20rb pcs", "PT.KALBE FARMA", 20000, 10, "Art Carton", "230 Gr"),
    ("[DEMO] Box Kopi 3rb pcs", "CV.KOPI NUSANTARA", 3000, 22, "Ivory", "250 Gr"),
    ("[DEMO] Sleeve Shampo 15rb", "PT.UNILEVER IDN", 15000, 14, "Art Paper", "120 Gr"),
]


def seed_hpp(token):
    ok = 0
    for name, cust, qty, laba, bahan, gram in HPP_ITEMS:
        subtotal = qty * random.randint(900, 2600)
        laba_rp = round(subtotal * laba / 100)
        bunga = round(subtotal * 0.01)
        dpp = subtotal + laba_rp + bunga
        ppn = round(dpp * 0.11)
        st, r = req("POST", "/hpp/calculations", token, {
            "name": name, "customer": cust,
            "notes": "Perhitungan demo untuk peragaan aplikasi.",
            "inputs": hpp_inputs(qty, laba, bahan, gram),
            "result": {
                "subtotal": subtotal,
                "subtotalPerPcs": round(subtotal / qty, 2),
                "laba": laba_rp, "bunga": bunga,
                "dpp": dpp, "ppn": ppn,
                "total": dpp + ppn,
                "hargaJualPerPcs": round((dpp + ppn) / qty, 2),
                "qtyOrder": qty,
            },
        })
        if st == 200:
            ok += 1
            remember("hpp", r.get("id"))
        else:
            print("  HPP gagal:", st, r)
    return ok


# ----------------------------------------------------------------------- WIPE
def wipe(token):
    """Hapus data dummy berdasarkan daftar ID yang dicatat saat seeding,
    dengan fallback heuristik (supplier/nama/prefix) untuk data lama."""
    try:
        ids = json.load(open(IDS_FILE))
    except Exception:
        ids = {}

    total = 0
    for kind, path in (("paper", "/paper/mutations"), ("ink", "/ink/mutations"), ("other", "/other/mutations")):
        for mid in ids.get(kind, []):
            st, _ = req("DELETE", f"{path}/{mid}", token)
            if st == 200:
                total += 1
    for pid in ids.get("pos", []):
        st, _ = req("DELETE", f"/po/pos/{pid}", token)
        if st == 200:
            total += 1
    for cid in ids.get("hpp", []):
        st, _ = req("DELETE", f"/hpp/calculations/{cid}", token)
        if st == 200:
            total += 1

    # fallback heuristik
    paper_names = [p[0] for p in PAPER_JENIS]
    ink_names = [i[0] for i in INK_JENIS]
    other_names = [o[0] for o in DUMMY_OTHER]
    for kind, path, names, field in (
        ("paper", "/paper/mutations", paper_names, "jenis_kertas"),
        ("ink", "/ink/mutations", ink_names, "jenis_tinta"),
        ("other", "/other/mutations", other_names, "nama_barang"),
    ):
        st, rows = req("GET", path, token)
        if st != 200:
            continue
        for m in rows:
            if m.get("supplier") in DUMMY_SUPPLIERS or (
                m.get(field) in names and m.get("supplier") in DUMMY_SUPPLIERS
            ):
                st2, _ = req("DELETE", f"{path}/{m['id']}", token)
                if st2 == 200:
                    total += 1

    st, pos = req("GET", "/po/pos", token)
    if st == 200:
        for po in pos:
            if str(po.get("po_number", "")).startswith("SCA-"):
                if req("DELETE", f"/po/pos/{po['id']}", token)[0] == 200:
                    total += 1
    st, calcs = req("GET", "/hpp/calculations", token)
    if st == 200:
        for c in calcs:
            if str(c.get("name", "")).startswith("[DEMO]"):
                if req("DELETE", f"/hpp/calculations/{c['id']}", token)[0] == 200:
                    total += 1

    try:
        json.dump({}, open(IDS_FILE, "w"))
    except Exception:
        pass
    print(f"Terhapus: {total} dokumen dummy")


def main():
    token = login()
    if "--wipe" in sys.argv:
        wipe(token)
        return

    if "--pos-only" in sys.argv:
        st, pos = req("GET", "/po/pos", token)
        n = 0
        if st == 200:
            for po in pos:
                if str(po.get("po_number", "")).startswith("SCA-"):
                    if req("DELETE", f"/po/pos/{po['id']}", token)[0] == 200:
                        n += 1
        print(f"PO dummy lama dihapus: {n}")
        pc, sd = seed_pos(token)
        print(f"PO baru: {pc} (update tahap: {sd})")
        st, dash = req("GET", "/po/dashboard", token)
        if st == 200:
            print("PO dashboard:", json.dumps(dash.get("counts"), indent=None))
            print("aktif:", dash.get("total_active"), "| selesai:", dash.get("total_completed"))
        save_ids()
        return

    print("Mengisi data dummy ke MongoDB Atlas…\n")
    n1 = seed_paper(token);  print(f"  Mutasi kertas : {n1}")
    n2 = seed_ink(token);    print(f"  Mutasi tinta  : {n2}")
    n3 = seed_other(token);  print(f"  Mutasi lain   : {n3}")
    pc, sd = seed_pos(token); print(f"  PO            : {pc} (update tahap: {sd})")
    n5 = seed_hpp(token);    print(f"  Perhitungan HPP: {n5}")

    st, dash = req("GET", "/dashboard", token)
    if st == 200:
        print("\nDashboard sekarang:")
        print("  Total stok kertas :", dash.get("paper_stock_total"), "Rim")
        print("  Total stok tinta  :", dash.get("ink_stock_total"), "Kg")
        print("  Total nominal     : Rp", f"{dash.get('nominal_total', 0):,.0f}".replace(",", "."))
    save_ids()
    print(f"Total mutasi ditambahkan: {n1 + n2 + n3}")


if __name__ == "__main__":
    main()
