"""Tests for new features: Mutasi Lain (other) and Kode field on mutations."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

SUPERADMIN = {"username": "Jeffsca", "password": "jeff3131"}


@pytest.fixture(scope="module")
def s_super():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=SUPERADMIN, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# unique tag to keep test data identifiable
TAG = f"TEST_{uuid.uuid4().hex[:6]}"
ITEM = f"Lem_{TAG}"


class TestOtherMutations:
    def test_create_masuk(self, s_super):
        payload = {
            "date": "2026-01-05",
            "kode": f"LN-{TAG}-100",
            "nama_barang": ITEM,
            "satuan": "pcs",
            "jenis_transaksi": "masuk",
            "jumlah": 10,
            "supplier": "Toko A",
            "pic_name": "TEST_PIC",
            "harga_per_satuan": 5000,
        }
        r = s_super.post(f"{API}/other/mutations", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["nama_barang"] == ITEM
        assert d["satuan"] == "pcs"
        assert d["kode"] == payload["kode"]
        assert d["harga_per_satuan"] == 5000
        assert d["jumlah"] == 10
        pytest.other_masuk_id = d["id"]
        pytest.other_masuk_kode = d["kode"]

    def test_list_contains(self, s_super):
        r = s_super.get(f"{API}/other/mutations?year=2026", timeout=15)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert pytest.other_masuk_id in ids

    def test_jenis_endpoint(self, s_super):
        r = s_super.get(f"{API}/other/jenis", timeout=15)
        assert r.status_code == 200
        assert ITEM in r.json()

    def test_stok_minus_guard(self, s_super):
        payload = {
            "date": "2026-01-06", "kode": "", "nama_barang": ITEM, "satuan": "pcs",
            "jenis_transaksi": "keluar", "jumlah": 999, "pic_name": "TEST_PIC",
        }
        r = s_super.post(f"{API}/other/mutations", json=payload, timeout=15)
        assert r.status_code == 400
        assert "Stok tidak cukup" in r.json().get("detail", "")

    def test_keluar_ok(self, s_super):
        payload = {
            "date": "2026-01-06", "kode": "", "nama_barang": ITEM, "satuan": "pcs",
            "jenis_transaksi": "keluar", "jumlah": 3, "pic_name": "TEST_PIC",
        }
        r = s_super.post(f"{API}/other/mutations", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        pytest.other_keluar_id = r.json()["id"]

    def test_retur_with_ref(self, s_super):
        payload = {
            "date": "2026-01-07", "kode": pytest.other_masuk_kode, "nama_barang": ITEM, "satuan": "pcs",
            "jenis_transaksi": "retur", "jumlah": 1, "pic_name": "TEST_PIC",
            "ref_mutation_id": pytest.other_keluar_id,
        }
        r = s_super.post(f"{API}/other/mutations", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ref_mutation_id"] == pytest.other_keluar_id
        pytest.other_retur_id = d["id"]

    def test_stock_in_report(self, s_super):
        r = s_super.get(f"{API}/reports/stock", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "other" in data, "Stock report missing 'other' section"
        item = next((x for x in data["other"] if x["nama_barang"] == ITEM), None)
        assert item is not None
        # 10 masuk - 3 keluar + 1 retur = 8
        assert item["stock"] == 8.0
        assert item["satuan"] == "pcs"
        # supplier breakdown
        assert isinstance(item.get("suppliers"), list)
        supp_map = {s["supplier"]: s["stock"] for s in item["suppliers"]}
        # 10 came from Toko A, 3 keluar+1 retur likely have empty supplier => Tanpa Supplier
        assert supp_map.get("Toko A", 0) == 10.0

    def test_edit_creates_audit(self, s_super):
        payload = {
            "date": "2026-01-05", "kode": pytest.other_masuk_kode, "nama_barang": ITEM, "satuan": "pcs",
            "jenis_transaksi": "masuk", "jumlah": 12, "supplier": "Toko A",
            "pic_name": "TEST_PIC", "harga_per_satuan": 5000,
        }
        r = s_super.put(f"{API}/other/mutations/{pytest.other_masuk_id}", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["jumlah"] == 12
        r2 = s_super.get(f"{API}/logs/audit", timeout=15)
        assert r2.status_code == 200
        found = any(a.get("mutation_id") == pytest.other_masuk_id and a.get("action") == "edit"
                    and a.get("mutation_type") == "other" for a in r2.json())
        assert found, "Edit audit entry not found with mutation_type=other"

    def test_delete_creates_audit(self, s_super):
        r = s_super.delete(f"{API}/other/mutations/{pytest.other_retur_id}", timeout=15)
        assert r.status_code == 200
        r2 = s_super.delete(f"{API}/other/mutations/{pytest.other_keluar_id}", timeout=15)
        assert r2.status_code == 200
        r3 = s_super.delete(f"{API}/other/mutations/{pytest.other_masuk_id}", timeout=15)
        assert r3.status_code == 200
        r4 = s_super.get(f"{API}/logs/audit", timeout=15)
        found = any(a.get("mutation_id") == pytest.other_masuk_id and a.get("action") == "delete"
                    and a.get("mutation_type") == "other" for a in r4.json())
        assert found


class TestKodeOnPaperInk:
    def test_paper_kode_persisted(self, s_super):
        payload = {
            "date": "2026-01-05", "kode": f"KP-{TAG}", "jenis_kertas": f"TEST_K_{TAG}",
            "gramatur": 80, "panjang": 65, "lebar": 100,
            "jenis_transaksi": "masuk", "jumlah": 5, "supplier": "SupA",
            "pic_name": "TEST_PIC", "price_mode": "per_rim", "price_input": 100000,
        }
        r = s_super.post(f"{API}/paper/mutations", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kode"] == payload["kode"]
        pytest.paper_kode_id = d["id"]

    def test_ink_kode_persisted(self, s_super):
        payload = {
            "date": "2026-01-05", "kode": f"KI-{TAG}", "jenis_tinta": f"TEST_I_{TAG}",
            "jenis_transaksi": "masuk", "jumlah": 5, "supplier": "SupB",
            "pic_name": "TEST_PIC", "harga_per_kg": 50000,
        }
        r = s_super.post(f"{API}/ink/mutations", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kode"] == payload["kode"]
        pytest.ink_kode_id = d["id"]

    def test_cleanup(self, s_super):
        s_super.delete(f"{API}/paper/mutations/{pytest.paper_kode_id}", timeout=15)
        s_super.delete(f"{API}/ink/mutations/{pytest.ink_kode_id}", timeout=15)


class TestOtherPDFAndReports:
    def test_pdf_other_mutations(self, s_super):
        r = s_super.get(f"{API}/pdf/other-mutations", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500

    def test_dashboard_includes_nominal_other(self, s_super):
        r = s_super.get(f"{API}/dashboard", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "nominal_other" in d
        assert isinstance(d["nominal_other"], (int, float))
        assert d["nominal_total"] >= d["nominal_other"]

    def test_detail_includes_other(self, s_super):
        r = s_super.get(f"{API}/reports/detail", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "nominal_other" in d
        assert "other_composition" in d
        # monthly_value must include 'other' key
        assert all("other" in x for x in d["monthly_value"])
        # PPN monthly must include 'other'
        assert all("other" in x for x in d["ppn_monthly"])
