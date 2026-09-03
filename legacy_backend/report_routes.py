import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from database import db
from security import get_current_user, require_superadmin, hash_password, verify_temp_password
from stock import compute_paper_stocks, compute_ink_stocks, compute_other_stocks, signed_qty, paper_key

router = APIRouter(prefix="/api", tags=["reports"])

ID_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def current_year():
    return datetime.now(timezone.utc).year


async def require_section_access(request: Request, current=Depends(get_current_user)):
    if current.get("role") == "superadmin":
        return current
    pwd = request.headers.get("X-Section-Password", "")
    if await verify_temp_password(pwd):
        return current
    raise HTTPException(status_code=403, detail="Akses section terkunci")


def clean(doc):
    doc.pop("_id", None)
    return doc


async def all_year(collection, year):
    docs = await db[collection].find({"year": year}).to_list(100000)
    return [clean(d) for d in docs]


def in_range(d, start, end):
    return (not start or d["date"] >= start) and (not end or d["date"] <= end)


# ---------------- DASHBOARD ----------------
@router.get("/dashboard")
async def dashboard(current=Depends(get_current_user)):
    year = current_year()
    paper = await all_year("paper_mutations", year)
    ink = await all_year("ink_mutations", year)
    other = await all_year("other_mutations", year)

    p_stocks = compute_paper_stocks(paper)
    i_stocks = compute_ink_stocks(ink)
    o_stocks = compute_other_stocks(other)
    total_paper = round(sum(max(v["stock"], 0) for v in p_stocks.values()), 2)
    total_ink = round(sum(max(v["stock"], 0) for v in i_stocks.values()), 2)
    nominal_paper = round(sum(v["nominal"] for v in p_stocks.values()), 2)
    nominal_ink = round(sum(v["nominal"] for v in i_stocks.values()), 2)
    nominal_other = round(sum(v["nominal"] for v in o_stocks.values()), 2)

    today = datetime.now(timezone.utc).date().isoformat()
    mutations_today = sum(1 for m in paper + ink + other if m["date"] == today)

    # last 6 months trend
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        mm = now.month - i
        yy = now.year
        while mm <= 0:
            mm += 12
            yy -= 1
        months.append((yy, mm))
    trend = []
    for yy, mm in months:
        prefix = f"{yy}-{mm:02d}"
        pm = sum(m["jumlah"] for m in paper if m["date"].startswith(prefix) and m["jenis_transaksi"] == "masuk")
        pk = sum(m["jumlah"] for m in paper if m["date"].startswith(prefix) and m["jenis_transaksi"] == "keluar")
        im = sum(m["jumlah"] for m in ink if m["date"].startswith(prefix) and m["jenis_transaksi"] == "masuk")
        ik = sum(m["jumlah"] for m in ink if m["date"].startswith(prefix) and m["jenis_transaksi"] == "keluar")
        trend.append({"label": ID_MONTHS[mm - 1][:3], "paper_masuk": round(pm, 2), "paper_keluar": round(pk, 2),
                      "ink_masuk": round(im, 2), "ink_keluar": round(ik, 2)})

    combined = []
    for m in paper:
        combined.append({**m, "kategori": "Kertas", "satuan": "Rim", "nama": m["jenis_kertas"]})
    for m in ink:
        combined.append({**m, "kategori": "Tinta", "satuan": "Kg", "nama": m["jenis_tinta"]})
    for m in other:
        combined.append({**m, "kategori": "Lain", "satuan": m.get("satuan") or "unit", "nama": m["nama_barang"]})
    combined.sort(key=lambda x: (x["date"], x.get("created_at", "")), reverse=True)
    recent = combined[:10]

    result = {
        "total_paper_stock": total_paper,
        "total_ink_stock": total_ink,
        "mutations_today": mutations_today,
        "trend": trend,
        "recent": recent,
        "year": year,
    }
    if current.get("role") == "superadmin":
        result["nominal_paper"] = nominal_paper
        result["nominal_ink"] = nominal_ink
        result["nominal_other"] = nominal_other
        result["nominal_total"] = round(nominal_paper + nominal_ink + nominal_other, 2)
    return result


# ---------------- STOCK RINGKAS ----------------
async def compute_stock():
    year = current_year()
    paper = await all_year("paper_mutations", year)
    ink = await all_year("ink_mutations", year)
    other = await all_year("other_mutations", year)
    p = compute_paper_stocks(paper)
    i = compute_ink_stocks(ink)
    o = compute_other_stocks(other)

    psup = {}
    for m in paper:
        k = paper_key(m)
        s = (m.get("supplier") or "").strip() or "Tanpa Supplier"
        psup.setdefault(k, {}).setdefault(s, 0.0)
        psup[k][s] += signed_qty(m)
    paper_list = []
    for k, v in p.items():
        suppliers = [{"supplier": s, "stock": round(q, 3)} for s, q in psup.get(k, {}).items() if round(q, 3) != 0]
        suppliers.sort(key=lambda x: -x["stock"])
        paper_list.append({"jenis_kertas": v["jenis_kertas"], "gramatur": v["gramatur"], "panjang": v["panjang"],
                           "lebar": v["lebar"], "stock": v["stock"], "suppliers": suppliers})

    isup = {}
    for m in ink:
        k = m.get("jenis_tinta", "")
        s = (m.get("supplier") or "").strip() or "Tanpa Supplier"
        isup.setdefault(k, {}).setdefault(s, 0.0)
        isup[k][s] += signed_qty(m)
    ink_list = []
    for k, v in i.items():
        suppliers = [{"supplier": s, "stock": round(q, 3)} for s, q in isup.get(k, {}).items() if round(q, 3) != 0]
        suppliers.sort(key=lambda x: -x["stock"])
        ink_list.append({"jenis_tinta": v["jenis_tinta"], "stock": v["stock"], "suppliers": suppliers})

    osup = {}
    for m in other:
        k = m.get("nama_barang", "")
        s = (m.get("supplier") or "").strip() or "Tanpa Supplier"
        osup.setdefault(k, {}).setdefault(s, 0.0)
        osup[k][s] += signed_qty(m)
    other_list = []
    for k, v in o.items():
        suppliers = [{"supplier": s, "stock": round(q, 3)} for s, q in osup.get(k, {}).items() if round(q, 3) != 0]
        suppliers.sort(key=lambda x: -x["stock"])
        other_list.append({"nama_barang": v["nama_barang"], "satuan": v["satuan"], "stock": v["stock"], "suppliers": suppliers})

    paper_list.sort(key=lambda x: (x["jenis_kertas"], x["gramatur"]))
    ink_list.sort(key=lambda x: x["jenis_tinta"])
    other_list.sort(key=lambda x: x["nama_barang"])
    return {"paper": paper_list, "ink": ink_list, "other": other_list, "year": year}


@router.get("/reports/stock")
async def stock_report(current=Depends(get_current_user)):
    return await compute_stock()


# ---------------- DETAIL (protected) ----------------
def subset_up_to(muts, end):
    return [m for m in muts if not end or m["date"] <= end]


def count_range(muts, start, end, transaksi):
    return sum(1 for m in muts if in_range(m, start, end) and m["jenis_transaksi"] == transaksi)


@router.get("/reports/detail")
async def detail_report(request: Request, start: Optional[str] = None, end: Optional[str] = None,
                        current=Depends(require_section_access)):
    return await compute_detail(start, end)


async def compute_detail(start: Optional[str] = None, end: Optional[str] = None):
    year = current_year()
    if not start:
        start = f"{year}-01-01"
    if not end:
        end = datetime.now(timezone.utc).date().isoformat()
    paper = await all_year("paper_mutations", year)
    ink = await all_year("ink_mutations", year)
    other = await all_year("other_mutations", year)

    # nominal at end of period
    p_stocks = compute_paper_stocks(subset_up_to(paper, end))
    i_stocks = compute_ink_stocks(subset_up_to(ink, end))
    o_stocks = compute_other_stocks(subset_up_to(other, end))
    nominal_paper = round(sum(v["nominal"] for v in p_stocks.values()), 2)
    nominal_ink = round(sum(v["nominal"] for v in i_stocks.values()), 2)
    nominal_other = round(sum(v["nominal"] for v in o_stocks.values()), 2)

    paper_comp = [{"name": v["jenis_kertas"], "value": v["nominal"]} for v in p_stocks.values() if v["nominal"] > 0]
    ink_comp = [{"name": v["jenis_tinta"], "value": v["nominal"]} for v in i_stocks.values() if v["nominal"] > 0]
    other_comp = [{"name": v["nama_barang"], "value": v["nominal"]} for v in o_stocks.values() if v["nominal"] > 0]

    # monthly trend masuk/keluar (Jan..current month)
    now = datetime.now(timezone.utc)
    last_month = now.month if year == now.year else 12
    monthly_trend = []
    monthly_value = []
    for mm in range(1, last_month + 1):
        prefix = f"{year}-{mm:02d}"
        month_end = f"{year}-{mm:02d}-31"
        pm = sum(m["jumlah"] for m in paper if m["date"].startswith(prefix) and m["jenis_transaksi"] == "masuk")
        pk = sum(m["jumlah"] for m in paper if m["date"].startswith(prefix) and m["jenis_transaksi"] == "keluar")
        im = sum(m["jumlah"] for m in ink if m["date"].startswith(prefix) and m["jenis_transaksi"] == "masuk")
        ik = sum(m["jumlah"] for m in ink if m["date"].startswith(prefix) and m["jenis_transaksi"] == "keluar")
        monthly_trend.append({"label": ID_MONTHS[mm - 1][:3], "paper_masuk": round(pm, 2), "paper_keluar": round(pk, 2),
                              "ink_masuk": round(im, 2), "ink_keluar": round(ik, 2)})
        pv = sum(v["nominal"] for v in compute_paper_stocks(subset_up_to(paper, month_end)).values())
        iv = sum(v["nominal"] for v in compute_ink_stocks(subset_up_to(ink, month_end)).values())
        ov = sum(v["nominal"] for v in compute_other_stocks(subset_up_to(other, month_end)).values())
        monthly_value.append({"label": ID_MONTHS[mm - 1][:3], "paper": round(pv, 2), "ink": round(iv, 2),
                              "other": round(ov, 2), "total": round(pv + iv + ov, 2)})

    # PPN monthly (full year)
    ppn_monthly = []
    for mm in range(1, 13):
        prefix = f"{year}-{mm:02d}"
        pp = sum(m.get("ppn_nominal", 0) for m in paper if m["date"].startswith(prefix) and m.get("ppn_ada"))
        ip = sum(m.get("ppn_nominal", 0) for m in ink if m["date"].startswith(prefix) and m.get("ppn_ada"))
        op = sum(m.get("ppn_nominal", 0) for m in other if m["date"].startswith(prefix) and m.get("ppn_ada"))
        ppn_monthly.append({"label": ID_MONTHS[mm - 1], "paper": round(pp, 2), "ink": round(ip, 2),
                            "other": round(op, 2), "total": round(pp + ip + op, 2)})

    # comparison with previous period of same length
    sd = date.fromisoformat(start)
    ed = date.fromisoformat(end)
    length = (ed - sd).days
    prev_end = sd - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length)
    prev_end_s = prev_end.isoformat()
    prev_start_s = prev_start.isoformat()

    prev_p = compute_paper_stocks(subset_up_to(paper, prev_end_s))
    prev_i = compute_ink_stocks(subset_up_to(ink, prev_end_s))
    prev_o = compute_other_stocks(subset_up_to(other, prev_end_s))
    prev_nominal_paper = round(sum(v["nominal"] for v in prev_p.values()), 2)
    prev_nominal_ink = round(sum(v["nominal"] for v in prev_i.values()), 2)
    prev_nominal_other = round(sum(v["nominal"] for v in prev_o.values()), 2)

    def pct(cur, prev):
        if prev == 0:
            return 100.0 if cur > 0 else 0.0
        return round((cur - prev) / prev * 100, 1)

    comparison = {
        "prev_start": prev_start_s, "prev_end": prev_end_s,
        "paper_nominal": {"current": nominal_paper, "prev": prev_nominal_paper,
                          "diff": round(nominal_paper - prev_nominal_paper, 2), "pct": pct(nominal_paper, prev_nominal_paper)},
        "ink_nominal": {"current": nominal_ink, "prev": prev_nominal_ink,
                        "diff": round(nominal_ink - prev_nominal_ink, 2), "pct": pct(nominal_ink, prev_nominal_ink)},
        "other_nominal": {"current": nominal_other, "prev": prev_nominal_other,
                          "diff": round(nominal_other - prev_nominal_other, 2), "pct": pct(nominal_other, prev_nominal_other)},
        "paper_masuk": {"current": count_range(paper, start, end, "masuk"), "prev": count_range(paper, prev_start_s, prev_end_s, "masuk")},
        "paper_keluar": {"current": count_range(paper, start, end, "keluar"), "prev": count_range(paper, prev_start_s, prev_end_s, "keluar")},
        "ink_masuk": {"current": count_range(ink, start, end, "masuk"), "prev": count_range(ink, prev_start_s, prev_end_s, "masuk")},
        "ink_keluar": {"current": count_range(ink, start, end, "keluar"), "prev": count_range(ink, prev_start_s, prev_end_s, "keluar")},
    }

    return {
        "start": start, "end": end, "year": year,
        "nominal_paper": nominal_paper, "nominal_ink": nominal_ink, "nominal_other": nominal_other,
        "nominal_total": round(nominal_paper + nominal_ink + nominal_other, 2),
        "paper_composition": paper_comp, "ink_composition": ink_comp, "other_composition": other_comp,
        "monthly_trend": monthly_trend, "monthly_value": monthly_value,
        "ppn_monthly": ppn_monthly,
        "ppn_total_year": round(sum(x["total"] for x in ppn_monthly), 2),
        "comparison": comparison,
    }


# ---------------- LOGS ----------------
@router.get("/logs/activity")
async def activity_logs(current=Depends(require_section_access)):
    docs = await db.activity_logs.find().sort("login_time", -1).to_list(1000)
    return [clean(d) for d in docs]


@router.get("/logs/audit")
async def audit_logs(current=Depends(require_section_access)):
    docs = await db.audit_logs.find().sort("timestamp", -1).to_list(1000)
    return [clean(d) for d in docs]


# ---------------- USERS ----------------
class UserInput(BaseModel):
    name: str
    username: str
    password: str
    role: str


@router.get("/users")
async def list_users(current=Depends(require_superadmin)):
    docs = await db.users.find().sort("created_at", 1).to_list(1000)
    out = []
    for d in docs:
        clean(d)
        d.pop("password_hash", None)
        out.append(d)
    return out


@router.post("/users")
async def create_user(data: UserInput, current=Depends(require_superadmin)):
    existing = await db.users.find_one({"username": data.username.strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")
    if data.role not in ("superadmin", "admin"):
        raise HTTPException(status_code=400, detail="Role tidak valid")
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "username": data.username.strip(),
        "password_hash": hash_password(data.password),
        "role": data.role,
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(doc))
    doc.pop("password_hash")
    doc.pop("_id", None)
    return doc


@router.patch("/users/{uid}/toggle")
async def toggle_user(uid: str, current=Depends(require_superadmin)):
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if user["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan diri sendiri")
    await db.users.update_one({"id": uid}, {"$set": {"active": not user.get("active", True)}})
    return {"success": True, "active": not user.get("active", True)}


@router.delete("/users/{uid}")
async def delete_user(uid: str, current=Depends(require_superadmin)):
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if user["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus diri sendiri")
    await db.users.delete_one({"id": uid})
    return {"success": True}


class TempPwdChange(BaseModel):
    new_password: str


@router.post("/settings/temp-password")
async def change_temp_password(data: TempPwdChange, current=Depends(require_superadmin)):
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password minimal 4 karakter")
    await db.settings.update_one(
        {"key": "temp_password"},
        {"$set": {"hash": hash_password(data.new_password), "updated_at": now_iso()}},
        upsert=True,
    )
    return {"success": True}


# ---------------- YEAR CLOSE ----------------
@router.post("/year/close")
async def year_close(current=Depends(require_section_access)):
    r1 = await db.paper_mutations.delete_many({})
    r2 = await db.ink_mutations.delete_many({})
    r3 = await db.other_mutations.delete_many({})
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "user_id": current["id"], "name": current["name"],
        "action": "tutup_tahun", "mutation_type": "all", "mutation_id": None,
        "before": {"paper_deleted": r1.deleted_count, "ink_deleted": r2.deleted_count, "other_deleted": r3.deleted_count},
        "after": None, "timestamp": now_iso(),
    })
    return {"success": True, "paper_deleted": r1.deleted_count, "ink_deleted": r2.deleted_count, "other_deleted": r3.deleted_count}
