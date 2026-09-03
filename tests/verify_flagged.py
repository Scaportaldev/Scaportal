"""Verifikasi item yang timeout di laporan testing agent (PO stages, delivery flow, HPP PDF)."""
import json
import os
import urllib.request
import urllib.error

BASE = "http://localhost:8001/api"


def req(method, path, token=None, body=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            payload = resp.read()
            if raw:
                return resp.status, payload
            return resp.status, json.loads(payload or b"{}")
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload or b"{}")
        except Exception:
            return e.code, payload[:200]


def main():
    ok = fail = 0

    def check(label, cond, extra=""):
        nonlocal ok, fail
        if cond:
            ok += 1
            print(f"  PASS  {label}")
        else:
            fail += 1
            print(f"  FAIL  {label}  {extra}")

    # Kredensial dari environment (jangan hardcode di repo).
    USER = os.environ.get("SUPERADMIN_USERNAME", "admin")
    PASS = os.environ.get("SUPERADMIN_PASSWORD", "")
    st, r = req("POST", "/auth/login", body={"username": USER, "password": PASS, "role": "superadmin"})
    token = r["token"]
    print("login superadmin:", st)

    # ---- HPP PDF (POST) ----
    print("\n[HPP PDF]")
    st, body = req("POST", "/hpp/pdf", token, {
        "name": "Tes HPP", "customer": "PT Uji", "result": {"total": 1000000, "hpp_per_pcs": 1000},
    }, raw=True)
    check("POST /hpp/pdf -> PDF", st == 200 and body[:4] == b"%PDF", f"status={st}")

    # ---- PO create ----
    print("\n[PO stages]")
    st, po = req("POST", "/po/pos", token, {
        "po_number": "VERIF-STAGE-001", "client_name": "PT Verifikasi",
        "item_type": "Box", "material": "Ivory 250", "paper_size": "65x100",
        "quantity": "5000", "po_date": "2026-08-27",
        "est_start": "2026-09-01", "est_end": "2026-09-05",
        "enabled_stages": [1, 2, 3, 6, 11],
    })
    check("create PO", st == 200, str(po)[:200])
    pid = po.get("id")

    # tahap 1: single face
    st, r = req("POST", f"/po/pos/{pid}/stages/1", token, {"data": {"needs_single_face": True, "paper_arrived": True}})
    check("tahap 1 single face (belum lengkap -> belum done)", st == 200 and r["computed"]["current_stage"] == 1, str(r)[:200])
    st, r = req("POST", f"/po/pos/{pid}/stages/1", token, {"data": {"single_face_arrived": True}})
    check("tahap 1 lengkap -> pindah ke tahap 2", st == 200 and r["computed"]["current_stage"] == 2, str(r.get("computed"))[:200])

    # tahap 2 & 3 arrived
    st, r = req("POST", f"/po/pos/{pid}/stages/2", token, {"data": {"arrived": True}})
    check("tahap 2 arrived", st == 200 and r["computed"]["current_stage"] == 3, str(r.get("computed"))[:200])
    st, r = req("POST", f"/po/pos/{pid}/stages/3", token, {"data": {"arrived": True}})
    check("tahap 3 arrived -> tahap 6", st == 200 and r["computed"]["current_stage"] == 6, str(r.get("computed"))[:200])

    # tahap 6 multi finishing
    st, r = req("POST", f"/po/pos/{pid}/stages/6", token,
                {"data": {"finishing": ["laminasi_glossy", "uv_spot", "emboss"], "done": True}})
    d6 = (r.get("stage_data") or {}).get("6", {})
    check("tahap 6 multi finishing tersimpan", st == 200 and len(d6.get("finishing", [])) == 3, str(d6)[:200])
    check("tahap 6 done -> tahap 11", r["computed"]["current_stage"] == 11, str(r.get("computed"))[:200])
    check("bucket 'printing' sebelum print_completed", r["computed"]["bucket"] == "printing", r["computed"]["bucket"])

    # ---- delivery flow tahap 11 ----
    print("\n[Delivery flow tahap 11]")
    st, r = req("POST", f"/po/pos/{pid}/delivery/result", token, {"status": "success"})
    check("result tanpa jadwal -> 400", st == 400, str(r)[:120])

    st, r = req("POST", f"/po/pos/{pid}/stages/11", token, {"data": {"print_completed": True}})
    check("print_completed -> delivery_status no_schedule",
          st == 200 and r["computed"]["delivery_status"] == "no_schedule", str(r.get("computed"))[:200])

    st, r = req("POST", f"/po/pos/{pid}/delivery/schedule", token,
                {"scheduled_date": "2026-09-06", "driver_name": "Budi"})
    att = (r.get("stage_data") or {}).get("11", {}).get("delivery_attempts", [])
    check("schedule 1 dibuat (attempts=1, status waiting)",
          st == 200 and len(att) == 1 and att[0]["status"] == "waiting", str(att)[:250])

    st, r = req("POST", f"/po/pos/{pid}/delivery/result", token,
                {"status": "failed", "failure_reason": "Alamat tidak ditemukan"})
    att = (r.get("stage_data") or {}).get("11", {}).get("delivery_attempts", [])
    check("result GAGAL tercatat di attempt 1",
          st == 200 and att[0]["status"] == "failed" and att[0]["failure_reason"] == "Alamat tidak ditemukan", str(att)[:250])
    check("bucket -> delivery_failed", r["computed"]["bucket"] == "delivery_failed", r["computed"]["bucket"])

    st, r = req("POST", f"/po/pos/{pid}/delivery/schedule", token,
                {"scheduled_date": "2026-09-08", "driver_name": "Andi"})
    att = (r.get("stage_data") or {}).get("11", {}).get("delivery_attempts", [])
    check("RESCHEDULE -> attempts jadi 2 (riwayat attempt 1 tetap ada)",
          st == 200 and len(att) == 2 and att[0]["status"] == "failed" and att[1]["status"] == "waiting", str(att)[:350])

    st, r = req("POST", f"/po/pos/{pid}/delivery/result", token, {"status": "success"})
    att = (r.get("stage_data") or {}).get("11", {}).get("delivery_attempts", [])
    check("attempt 2 SUKSES -> PO completed",
          st == 200 and att[1]["status"] == "success" and r["computed"]["is_completed"] is True,
          str(r.get("computed"))[:200])
    check("total attempts tersimpan = 2", len(att) == 2, str(len(att)))

    # ---- check-conflict ----
    print("\n[check-conflict]")
    st, r = req("POST", "/po/pos/check-conflict", token, {"est_start": "2026-09-02", "est_end": "2026-09-03"})
    check("PO completed tidak dihitung bentrok", st == 200 and len(r["conflicts"]) == 0, str(r)[:200])

    st, po2 = req("POST", "/po/pos", token, {
        "po_number": "VERIF-STAGE-002", "client_name": "PT Bentrok",
        "est_start": "2026-10-01", "est_end": "2026-10-10", "enabled_stages": [1, 11],
    })
    pid2 = po2.get("id")
    st, r = req("POST", "/po/pos/check-conflict", token, {"est_start": "2026-10-05", "est_end": "2026-10-07"})
    check("PO aktif overlap -> terdeteksi bentrok", st == 200 and len(r["conflicts"]) == 1, str(r)[:250])
    st, r = req("POST", "/po/pos/check-conflict", token, {"est_start": "2026-11-01", "est_end": "2026-11-05"})
    check("tanggal tidak overlap -> tidak bentrok", st == 200 and len(r["conflicts"]) == 0, str(r)[:200])
    st, r = req("POST", "/po/pos/check-conflict", token,
                {"est_start": "2026-10-05", "est_end": "2026-10-07", "exclude_id": pid2})
    check("exclude_id mengecualikan PO sendiri", st == 200 and len(r["conflicts"]) == 0, str(r)[:200])

    # ---- role mismatch ----
    print("\n[Auth negative]")
    st, r = req("POST", "/auth/login", body={"username": USER, "password": PASS, "role": "admin"})
    check("superadmin pilih role admin -> 401", st == 401, f"{st} {r}")
    st, r = req("POST", "/auth/login", body={"username": os.environ.get("TEST_ADMIN_USERNAME", "adminpic"), "password": os.environ.get("TEST_ADMIN_PASSWORD", ""), "role": "superadmin"})
    check("admin pilih role superadmin -> 401", st == 401, f"{st} {r}")
    st, r = req("POST", "/auth/login", body={"username": USER, "password": "salah-sekali", "role": "superadmin"})
    check("password salah -> 401", st == 401, f"{st} {r}")
    st, r = req("POST", "/auth/login", body={"username": USER, "password": PASS})
    check("tanpa role -> 400", st == 400, f"{st} {r}")

    # ---- cleanup ----
    print("\n[Cleanup]")
    for p in (pid, pid2):
        st, _ = req("DELETE", f"/po/pos/{p}", token)
        check(f"hapus PO {p[:8]}", st == 200, str(st))

    print(f"\n==== HASIL: {ok} PASS / {fail} FAIL ====")


if __name__ == "__main__":
    main()
