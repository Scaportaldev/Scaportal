"""Backend regression tests for StokKu API."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mutasi-stok.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPERADMIN = {"username": "Jeffsca", "password": "jeff3131"}
TEMP_PASSWORD = "superadminsementara"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s_super():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=SUPERADMIN, timeout=30)
    assert r.status_code == 200, f"Superadmin login failed: {r.text}"
    data = r.json()
    assert "token" in data and data["role"] == "superadmin"
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def admin_user(s_super):
    """Register a temporary admin PIC user."""
    uname = f"pic_{uuid.uuid4().hex[:6]}"
    payload = {"name": "TEST PIC", "username": uname, "password": "pic12345", "role": "admin"}
    r = s_super.post(f"{API}/users", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    yield {"username": uname, "password": "pic12345", "id": uid}
    # Cleanup
    try:
        s_super.delete(f"{API}/users/{uid}", timeout=15)
    except Exception:
        pass


@pytest.fixture(scope="session")
def s_admin(admin_user):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": admin_user["username"], "password": admin_user["password"]}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_login_wrong(self):
        r = requests.post(f"{API}/auth/login", json={"username": "Jeffsca", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, s_super):
        r = s_super.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["username"] == "Jeffsca"

    def test_verify_temp_admin(self, s_admin):
        r = s_admin.post(f"{API}/auth/verify-temp-password", json={"password": TEMP_PASSWORD}, timeout=15)
        assert r.status_code == 200 and r.json()["valid"] is True

    def test_verify_temp_admin_wrong(self, s_admin):
        r = s_admin.post(f"{API}/auth/verify-temp-password", json={"password": "salah"}, timeout=15)
        assert r.status_code == 403


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_superadmin_has_nominal(self, s_super):
        r = s_super.get(f"{API}/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_paper_stock", "total_ink_stock", "mutations_today", "trend", "recent", "year"):
            assert k in d
        assert "nominal_total" in d

    def test_dashboard_admin_hides_nominal(self, s_admin):
        r = s_admin.get(f"{API}/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "nominal_total" not in d
        assert "nominal_paper" not in d


# ---------- Paper Mutations ----------
class TestPaperMutations:
    def test_create_paper_masuk_per_kg(self, s_super):
        # gramatur 250, panjang 75, lebar 100, harga 12000 -> per rim = 250*75*100*12000/20000 = 1,125,000
        payload = {
            "date": "2026-01-05", "jenis_kertas": "TEST_HVS", "gramatur": 250, "panjang": 75, "lebar": 100,
            "jenis_transaksi": "masuk", "jumlah": 10, "supplier": "TEST_Supplier",
            "pic_name": "TEST_PIC", "price_mode": "per_kg", "price_input": 12000,
        }
        r = s_super.post(f"{API}/paper/mutations", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["harga_per_rim"] == 1125000.0
        assert d["jenis_transaksi"] == "masuk"
        pytest.paper_masuk_id = d["id"]

    def test_list_paper_and_contains(self, s_super):
        r = s_super.get(f"{API}/paper/mutations?year=2026", timeout=15)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert pytest.paper_masuk_id in ids

    def test_stok_minus_keluar(self, s_super):
        # Try to Keluar 9999 of TEST_HVS - should fail
        payload = {
            "date": "2026-01-06", "jenis_kertas": "TEST_HVS", "gramatur": 250, "panjang": 75, "lebar": 100,
            "jenis_transaksi": "keluar", "jumlah": 99999, "pic_name": "TEST_PIC",
        }
        r = s_super.post(f"{API}/paper/mutations", json=payload, timeout=15)
        assert r.status_code == 400
        assert "Stok tidak cukup" in r.json().get("detail", "")

    def test_keluar_then_retur(self, s_super):
        # Keluar 2
        p_out = {
            "date": "2026-01-07", "jenis_kertas": "TEST_HVS", "gramatur": 250, "panjang": 75, "lebar": 100,
            "jenis_transaksi": "keluar", "jumlah": 2, "pic_name": "TEST_PIC",
        }
        r = s_super.post(f"{API}/paper/mutations", json=p_out, timeout=15)
        assert r.status_code == 200
        out_id = r.json()["id"]
        # Retur ref out_id
        p_ret = {
            "date": "2026-01-08", "jenis_kertas": "TEST_HVS", "gramatur": 250, "panjang": 75, "lebar": 100,
            "jenis_transaksi": "retur", "jumlah": 1, "pic_name": "TEST_PIC", "ref_mutation_id": out_id,
        }
        r = s_super.post(f"{API}/paper/mutations", json=p_ret, timeout=15)
        assert r.status_code == 200
        assert r.json()["ref_mutation_id"] == out_id

    def test_stock_report(self, s_super):
        r = s_super.get(f"{API}/reports/stock", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "paper" in data and "ink" in data
        # After +10 masuk, -2 keluar, +1 retur => stock 9 for TEST_HVS
        for p in data["paper"]:
            if p["jenis_kertas"] == "TEST_HVS":
                assert p["stock"] == 9.0

    def test_delete_paper(self, s_super):
        r = s_super.delete(f"{API}/paper/mutations/{pytest.paper_masuk_id}", timeout=15)
        # This should succeed (superadmin can delete anytime)
        assert r.status_code == 200


# ---------- Ink Mutations ----------
class TestInkMutations:
    def test_create_ink_masuk_ppn(self, s_super):
        payload = {
            "date": "2026-01-05", "jenis_tinta": "TEST_Cyan", "jenis_transaksi": "masuk",
            "jumlah": 20, "supplier": "TEST_InkSupp", "pic_name": "TEST_PIC",
            "harga_per_kg": 50000, "ppn_ada": True, "ppn_nominal": 110000,
        }
        r = s_super.post(f"{API}/ink/mutations", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ppn_ada"] is True and d["ppn_nominal"] == 110000
        assert d["harga_per_kg"] == 50000
        pytest.ink_id = d["id"]

    def test_ink_stok_minus(self, s_super):
        payload = {
            "date": "2026-01-06", "jenis_tinta": "TEST_Cyan", "jenis_transaksi": "keluar",
            "jumlah": 99999, "pic_name": "TEST_PIC",
        }
        r = s_super.post(f"{API}/ink/mutations", json=payload, timeout=15)
        assert r.status_code == 400

    def test_delete_ink(self, s_super):
        r = s_super.delete(f"{API}/ink/mutations/{pytest.ink_id}", timeout=15)
        assert r.status_code == 200


# ---------- Detail Report / Section Access ----------
class TestDetailReport:
    def test_detail_superadmin(self, s_super):
        r = s_super.get(f"{API}/reports/detail", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("nominal_paper", "nominal_ink", "nominal_total", "paper_composition",
                  "monthly_trend", "monthly_value", "ppn_monthly", "comparison"):
            assert k in d

    def test_detail_admin_locked_without_password(self, s_admin):
        r = s_admin.get(f"{API}/reports/detail", timeout=15)
        assert r.status_code == 403

    def test_detail_admin_with_temp_password(self, s_admin):
        r = s_admin.get(f"{API}/reports/detail",
                        headers={"X-Section-Password": TEMP_PASSWORD}, timeout=30)
        assert r.status_code == 200

    def test_logs_admin_locked(self, s_admin):
        r = s_admin.get(f"{API}/logs/activity", timeout=15)
        assert r.status_code == 403

    def test_logs_admin_ok(self, s_admin):
        r = s_admin.get(f"{API}/logs/activity",
                        headers={"X-Section-Password": TEMP_PASSWORD}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Users (superadmin only) ----------
class TestUsers:
    def test_users_admin_forbidden(self, s_admin):
        r = s_admin.get(f"{API}/users", timeout=15)
        assert r.status_code == 403

    def test_users_list(self, s_super, admin_user):
        r = s_super.get(f"{API}/users", timeout=15)
        assert r.status_code == 200
        usernames = [u["username"] for u in r.json()]
        assert admin_user["username"] in usernames


# ---------- PDF endpoints ----------
class TestPDF:
    def test_pdf_paper_mutations(self, s_super):
        r = s_super.get(f"{API}/pdf/paper-mutations", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500

    def test_pdf_ink_mutations(self, s_super):
        r = s_super.get(f"{API}/pdf/ink-mutations", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")

    def test_pdf_stock_ringkas(self, s_super):
        r = s_super.get(f"{API}/pdf/stock-ringkas", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")

    def test_pdf_detail_admin_locked(self, s_admin):
        r = s_admin.get(f"{API}/pdf/detail", timeout=30)
        assert r.status_code == 403

    def test_pdf_detail_admin_with_pwd(self, s_admin):
        r = s_admin.get(f"{API}/pdf/detail", headers={"X-Section-Password": TEMP_PASSWORD}, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")

    def test_pdf_stock_nominal_super(self, s_super):
        r = s_super.get(f"{API}/pdf/stock-nominal", timeout=60)
        assert r.status_code == 200


# ---------- Temp Password change ----------
class TestTempPasswordChange:
    def test_change_temp_password_super_and_restore(self, s_super, s_admin):
        # Change to new
        new_pwd = "temppwdtest99"
        r = s_super.post(f"{API}/settings/temp-password", json={"new_password": new_pwd}, timeout=15)
        assert r.status_code == 200
        # Admin can now use new
        r2 = s_admin.post(f"{API}/auth/verify-temp-password", json={"password": new_pwd}, timeout=15)
        assert r2.status_code == 200
        # Old should fail
        r3 = s_admin.post(f"{API}/auth/verify-temp-password", json={"password": TEMP_PASSWORD}, timeout=15)
        assert r3.status_code == 403
        # Restore
        r4 = s_super.post(f"{API}/settings/temp-password", json={"new_password": TEMP_PASSWORD}, timeout=15)
        assert r4.status_code == 200

    def test_admin_cannot_change_temp(self, s_admin):
        r = s_admin.post(f"{API}/settings/temp-password", json={"new_password": "hackme123"}, timeout=15)
        assert r.status_code == 403


# ---------- Admin permissions on other users' mutations ----------
class TestAdminPermissions:
    def test_admin_cannot_edit_super_mutation(self, s_super, s_admin):
        # Create as super
        payload = {
            "date": "2026-01-05", "jenis_kertas": "TEST_Perm", "gramatur": 100, "panjang": 60, "lebar": 90,
            "jenis_transaksi": "masuk", "jumlah": 5, "pic_name": "sa", "price_mode": "per_rim", "price_input": 100000,
        }
        r = s_super.post(f"{API}/paper/mutations", json=payload, timeout=15)
        assert r.status_code == 200
        mid = r.json()["id"]
        # Admin tries to delete
        r2 = s_admin.delete(f"{API}/paper/mutations/{mid}", timeout=15)
        assert r2.status_code == 403
        # cleanup
        s_super.delete(f"{API}/paper/mutations/{mid}", timeout=15)


# ---------- Audit trail ----------
class TestAudit:
    def test_edit_creates_audit(self, s_super):
        # create
        payload = {
            "date": "2026-01-05", "jenis_kertas": "TEST_Audit", "gramatur": 80, "panjang": 65, "lebar": 100,
            "jenis_transaksi": "masuk", "jumlah": 3, "pic_name": "sa",
            "price_mode": "per_rim", "price_input": 100000,
        }
        r = s_super.post(f"{API}/paper/mutations", json=payload, timeout=15)
        mid = r.json()["id"]
        # edit
        payload["jumlah"] = 4
        r2 = s_super.put(f"{API}/paper/mutations/{mid}", json=payload, timeout=15)
        assert r2.status_code == 200
        # audit contains edit
        r3 = s_super.get(f"{API}/logs/audit", timeout=15)
        assert r3.status_code == 200
        found = any(a.get("mutation_id") == mid and a.get("action") == "edit" for a in r3.json())
        assert found, "Edit audit entry not found"
        # cleanup
        s_super.delete(f"{API}/paper/mutations/{mid}", timeout=15)
