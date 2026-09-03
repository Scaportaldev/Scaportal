import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from database import db
from security import get_current_user
from stock import (
    compute_harga_per_rim, current_paper_stock_for_key, current_ink_stock_for_key,
    current_other_stock_for_key,
)

router = APIRouter(prefix="/api", tags=["mutations"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def today_str():
    return datetime.now(timezone.utc).date().isoformat()


class PaperMutationInput(BaseModel):
    date: str
    kode: Optional[str] = ""
    jenis_kertas: str
    gramatur: float
    panjang: float
    lebar: float
    jenis_transaksi: str
    jumlah: float
    supplier: Optional[str] = ""
    pic_name: str
    price_mode: Optional[str] = "per_rim"
    price_input: Optional[float] = 0
    ppn_ada: Optional[bool] = False
    ppn_nominal: Optional[float] = 0
    ref_mutation_id: Optional[str] = None


class InkMutationInput(BaseModel):
    date: str
    kode: Optional[str] = ""
    jenis_tinta: str
    jenis_transaksi: str
    jumlah: float
    supplier: Optional[str] = ""
    pic_name: str
    harga_per_kg: Optional[float] = 0
    ppn_ada: Optional[bool] = False
    ppn_nominal: Optional[float] = 0
    ref_mutation_id: Optional[str] = None


def year_of(date_str):
    return int(date_str[:4])


async def get_year_mutations(collection, year):
    return await db[collection].find({"year": year}).to_list(100000)


def can_modify(current, mutation):
    if current["role"] == "superadmin":
        return True, ""
    if mutation.get("created_by") != current["id"]:
        return False, "Anda hanya bisa mengubah mutasi yang Anda input sendiri"
    created_date = (mutation.get("created_at") or "")[:10]
    if created_date != today_str():
        return False, "Mutasi hanya bisa diubah/hapus di hari yang sama saat dibuat"
    return True, ""


async def log_audit(current, action, mtype, mutation_id, before, after):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "name": current["name"],
        "action": action,
        "mutation_type": mtype,
        "mutation_id": mutation_id,
        "before": before,
        "after": after,
        "timestamp": now_iso(),
    })


def clean(doc):
    doc.pop("_id", None)
    return doc


# ---------------- PAPER ----------------
def build_paper_doc(data: PaperMutationInput):
    harga_per_rim = 0.0
    ppn = 0.0
    if data.jenis_transaksi == "masuk":
        harga_per_rim = compute_harga_per_rim(
            data.price_mode, data.price_input, data.gramatur, data.panjang, data.lebar, data.jumlah)
        ppn = float(data.ppn_nominal or 0) if data.ppn_ada else 0.0
    return {
        "date": data.date,
        "year": year_of(data.date),
        "kode": (data.kode or "").strip(),
        "jenis_kertas": data.jenis_kertas.strip(),
        "gramatur": data.gramatur,
        "panjang": data.panjang,
        "lebar": data.lebar,
        "jenis_transaksi": data.jenis_transaksi,
        "jumlah": data.jumlah,
        "supplier": (data.supplier or "").strip(),
        "pic_name": data.pic_name,
        "price_mode": data.price_mode if data.jenis_transaksi == "masuk" else None,
        "price_input": data.price_input if data.jenis_transaksi == "masuk" else None,
        "harga_per_rim": harga_per_rim,
        "ppn_ada": bool(data.ppn_ada) if data.jenis_transaksi == "masuk" else False,
        "ppn_nominal": ppn,
        "ref_mutation_id": data.ref_mutation_id if data.jenis_transaksi == "retur" else None,
    }


@router.get("/paper/mutations")
async def list_paper(
    current=Depends(get_current_user),
    year: Optional[int] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    jenis: Optional[str] = None,
    transaksi: Optional[str] = None,
    supplier: Optional[str] = None,
    search: Optional[str] = None,
):
    q = {}
    if year:
        q["year"] = year
    docs = await db.paper_mutations.find(q).sort("date", -1).to_list(100000)
    out = []
    for d in docs:
        clean(d)
        if start and d["date"] < start:
            continue
        if end and d["date"] > end:
            continue
        if jenis and d.get("jenis_kertas") != jenis:
            continue
        if transaksi and d.get("jenis_transaksi") != transaksi:
            continue
        if supplier and supplier.lower() not in (d.get("supplier") or "").lower():
            continue
        if search:
            blob = f"{d.get('jenis_kertas','')} {d.get('supplier','')} {d.get('pic_name','')} {d.get('kode','')}".lower()
            if search.lower() not in blob:
                continue
        out.append(d)
    out.sort(key=lambda x: (x["date"], x.get("created_at", "")), reverse=True)
    return out


@router.post("/paper/mutations")
async def create_paper(data: PaperMutationInput, current=Depends(get_current_user)):
    doc = build_paper_doc(data)
    if data.jenis_transaksi == "keluar":
        year_muts = await get_year_mutations("paper_mutations", year_of(data.date))
        avail = current_paper_stock_for_key(year_muts, doc["jenis_kertas"], doc["gramatur"], doc["panjang"], doc["lebar"])
        if data.jumlah > avail:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup, sisa stok saat ini: {avail} Rim")
    doc["id"] = str(uuid.uuid4())
    doc["created_by"] = current["id"]
    doc["created_by_name"] = current["name"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = None
    await db.paper_mutations.insert_one(dict(doc))
    return clean(doc)


@router.put("/paper/mutations/{mid}")
async def update_paper(mid: str, data: PaperMutationInput, current=Depends(get_current_user)):
    existing = await db.paper_mutations.find_one({"id": mid})
    if not existing:
        raise HTTPException(status_code=404, detail="Mutasi tidak ditemukan")
    ok, msg = can_modify(current, existing)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)
    new_doc = build_paper_doc(data)
    if data.jenis_transaksi == "keluar":
        year_muts = await get_year_mutations("paper_mutations", year_of(data.date))
        avail = current_paper_stock_for_key(year_muts, new_doc["jenis_kertas"], new_doc["gramatur"], new_doc["panjang"], new_doc["lebar"], exclude_id=mid)
        if data.jumlah > avail:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup, sisa stok saat ini: {avail} Rim")
    before = clean(dict(existing))
    new_doc["updated_at"] = now_iso()
    await db.paper_mutations.update_one({"id": mid}, {"$set": new_doc})
    updated = clean(await db.paper_mutations.find_one({"id": mid}))
    await log_audit(current, "edit", "paper", mid, before, updated)
    return updated


@router.delete("/paper/mutations/{mid}")
async def delete_paper(mid: str, current=Depends(get_current_user)):
    existing = await db.paper_mutations.find_one({"id": mid})
    if not existing:
        raise HTTPException(status_code=404, detail="Mutasi tidak ditemukan")
    ok, msg = can_modify(current, existing)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)
    before = clean(dict(existing))
    await db.paper_mutations.delete_one({"id": mid})
    await log_audit(current, "delete", "paper", mid, before, None)
    return {"success": True}


@router.get("/paper/jenis")
async def paper_jenis(current=Depends(get_current_user)):
    vals = await db.paper_mutations.distinct("jenis_kertas")
    return sorted([v for v in vals if v])


# ---------------- INK ----------------
def build_ink_doc(data: InkMutationInput):
    harga = 0.0
    ppn = 0.0
    if data.jenis_transaksi == "masuk":
        harga = float(data.harga_per_kg or 0)
        ppn = float(data.ppn_nominal or 0) if data.ppn_ada else 0.0
    return {
        "date": data.date,
        "year": year_of(data.date),
        "kode": (data.kode or "").strip(),
        "jenis_tinta": data.jenis_tinta.strip(),
        "jenis_transaksi": data.jenis_transaksi,
        "jumlah": data.jumlah,
        "supplier": (data.supplier or "").strip(),
        "pic_name": data.pic_name,
        "harga_per_kg": harga,
        "ppn_ada": bool(data.ppn_ada) if data.jenis_transaksi == "masuk" else False,
        "ppn_nominal": ppn,
        "ref_mutation_id": data.ref_mutation_id if data.jenis_transaksi == "retur" else None,
    }


@router.get("/ink/mutations")
async def list_ink(
    current=Depends(get_current_user),
    year: Optional[int] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    jenis: Optional[str] = None,
    transaksi: Optional[str] = None,
    supplier: Optional[str] = None,
    search: Optional[str] = None,
):
    q = {}
    if year:
        q["year"] = year
    docs = await db.ink_mutations.find(q).to_list(100000)
    out = []
    for d in docs:
        clean(d)
        if start and d["date"] < start:
            continue
        if end and d["date"] > end:
            continue
        if jenis and d.get("jenis_tinta") != jenis:
            continue
        if transaksi and d.get("jenis_transaksi") != transaksi:
            continue
        if supplier and supplier.lower() not in (d.get("supplier") or "").lower():
            continue
        if search:
            blob = f"{d.get('jenis_tinta','')} {d.get('supplier','')} {d.get('pic_name','')} {d.get('kode','')}".lower()
            if search.lower() not in blob:
                continue
        out.append(d)
    out.sort(key=lambda x: (x["date"], x.get("created_at", "")), reverse=True)
    return out


@router.post("/ink/mutations")
async def create_ink(data: InkMutationInput, current=Depends(get_current_user)):
    doc = build_ink_doc(data)
    if data.jenis_transaksi == "keluar":
        year_muts = await get_year_mutations("ink_mutations", year_of(data.date))
        avail = current_ink_stock_for_key(year_muts, doc["jenis_tinta"])
        if data.jumlah > avail:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup, sisa stok saat ini: {avail} Kg")
    doc["id"] = str(uuid.uuid4())
    doc["created_by"] = current["id"]
    doc["created_by_name"] = current["name"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = None
    await db.ink_mutations.insert_one(dict(doc))
    return clean(doc)


@router.put("/ink/mutations/{mid}")
async def update_ink(mid: str, data: InkMutationInput, current=Depends(get_current_user)):
    existing = await db.ink_mutations.find_one({"id": mid})
    if not existing:
        raise HTTPException(status_code=404, detail="Mutasi tidak ditemukan")
    ok, msg = can_modify(current, existing)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)
    new_doc = build_ink_doc(data)
    if data.jenis_transaksi == "keluar":
        year_muts = await get_year_mutations("ink_mutations", year_of(data.date))
        avail = current_ink_stock_for_key(year_muts, new_doc["jenis_tinta"], exclude_id=mid)
        if data.jumlah > avail:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup, sisa stok saat ini: {avail} Kg")
    before = clean(dict(existing))
    new_doc["updated_at"] = now_iso()
    await db.ink_mutations.update_one({"id": mid}, {"$set": new_doc})
    updated = clean(await db.ink_mutations.find_one({"id": mid}))
    await log_audit(current, "edit", "ink", mid, before, updated)
    return updated


@router.delete("/ink/mutations/{mid}")
async def delete_ink(mid: str, current=Depends(get_current_user)):
    existing = await db.ink_mutations.find_one({"id": mid})
    if not existing:
        raise HTTPException(status_code=404, detail="Mutasi tidak ditemukan")
    ok, msg = can_modify(current, existing)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)
    before = clean(dict(existing))
    await db.ink_mutations.delete_one({"id": mid})
    await log_audit(current, "delete", "ink", mid, before, None)
    return {"success": True}


@router.get("/ink/jenis")
async def ink_jenis(current=Depends(get_current_user)):
    vals = await db.ink_mutations.distinct("jenis_tinta")
    return sorted([v for v in vals if v])


# ---------------- OTHER (Mutasi Lain) ----------------
class OtherMutationInput(BaseModel):
    date: str
    kode: Optional[str] = ""
    nama_barang: str
    satuan: Optional[str] = ""
    jenis_transaksi: str
    jumlah: float
    supplier: Optional[str] = ""
    pic_name: str
    harga_per_satuan: Optional[float] = 0
    ppn_ada: Optional[bool] = False
    ppn_nominal: Optional[float] = 0
    ref_mutation_id: Optional[str] = None


def build_other_doc(data: OtherMutationInput):
    harga = 0.0
    ppn = 0.0
    if data.jenis_transaksi == "masuk":
        harga = float(data.harga_per_satuan or 0)
        ppn = float(data.ppn_nominal or 0) if data.ppn_ada else 0.0
    return {
        "date": data.date,
        "year": year_of(data.date),
        "kode": (data.kode or "").strip(),
        "nama_barang": data.nama_barang.strip(),
        "satuan": (data.satuan or "").strip(),
        "jenis_transaksi": data.jenis_transaksi,
        "jumlah": data.jumlah,
        "supplier": (data.supplier or "").strip(),
        "pic_name": data.pic_name,
        "harga_per_satuan": harga,
        "ppn_ada": bool(data.ppn_ada) if data.jenis_transaksi == "masuk" else False,
        "ppn_nominal": ppn,
        "ref_mutation_id": data.ref_mutation_id if data.jenis_transaksi == "retur" else None,
    }


@router.get("/other/mutations")
async def list_other(
    current=Depends(get_current_user),
    year: Optional[int] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    jenis: Optional[str] = None,
    transaksi: Optional[str] = None,
    supplier: Optional[str] = None,
    search: Optional[str] = None,
):
    q = {}
    if year:
        q["year"] = year
    docs = await db.other_mutations.find(q).to_list(100000)
    out = []
    for d in docs:
        clean(d)
        if start and d["date"] < start:
            continue
        if end and d["date"] > end:
            continue
        if jenis and d.get("nama_barang") != jenis:
            continue
        if transaksi and d.get("jenis_transaksi") != transaksi:
            continue
        if supplier and supplier.lower() not in (d.get("supplier") or "").lower():
            continue
        if search:
            blob = f"{d.get('nama_barang','')} {d.get('satuan','')} {d.get('supplier','')} {d.get('pic_name','')} {d.get('kode','')}".lower()
            if search.lower() not in blob:
                continue
        out.append(d)
    out.sort(key=lambda x: (x["date"], x.get("created_at", "")), reverse=True)
    return out


@router.post("/other/mutations")
async def create_other(data: OtherMutationInput, current=Depends(get_current_user)):
    doc = build_other_doc(data)
    if data.jenis_transaksi == "keluar":
        year_muts = await get_year_mutations("other_mutations", year_of(data.date))
        avail = current_other_stock_for_key(year_muts, doc["nama_barang"])
        if data.jumlah > avail:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup, sisa stok saat ini: {avail} {doc['satuan'] or 'unit'}")
    doc["id"] = str(uuid.uuid4())
    doc["created_by"] = current["id"]
    doc["created_by_name"] = current["name"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = None
    await db.other_mutations.insert_one(dict(doc))
    return clean(doc)


@router.put("/other/mutations/{mid}")
async def update_other(mid: str, data: OtherMutationInput, current=Depends(get_current_user)):
    existing = await db.other_mutations.find_one({"id": mid})
    if not existing:
        raise HTTPException(status_code=404, detail="Mutasi tidak ditemukan")
    ok, msg = can_modify(current, existing)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)
    new_doc = build_other_doc(data)
    if data.jenis_transaksi == "keluar":
        year_muts = await get_year_mutations("other_mutations", year_of(data.date))
        avail = current_other_stock_for_key(year_muts, new_doc["nama_barang"], exclude_id=mid)
        if data.jumlah > avail:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup, sisa stok saat ini: {avail} {new_doc['satuan'] or 'unit'}")
    before = clean(dict(existing))
    new_doc["updated_at"] = now_iso()
    await db.other_mutations.update_one({"id": mid}, {"$set": new_doc})
    updated = clean(await db.other_mutations.find_one({"id": mid}))
    await log_audit(current, "edit", "other", mid, before, updated)
    return updated


@router.delete("/other/mutations/{mid}")
async def delete_other(mid: str, current=Depends(get_current_user)):
    existing = await db.other_mutations.find_one({"id": mid})
    if not existing:
        raise HTTPException(status_code=404, detail="Mutasi tidak ditemukan")
    ok, msg = can_modify(current, existing)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)
    before = clean(dict(existing))
    await db.other_mutations.delete_one({"id": mid})
    await log_audit(current, "delete", "other", mid, before, None)
    return {"success": True}


@router.get("/other/jenis")
async def other_jenis(current=Depends(get_current_user)):
    vals = await db.other_mutations.distinct("nama_barang")
    return sorted([v for v in vals if v])
