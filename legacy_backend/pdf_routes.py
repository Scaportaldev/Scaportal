from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from database import db
from security import get_current_user
from report_routes import (
    require_section_access, compute_stock, compute_detail, all_year, current_year,
)
import pdf_utils

router = APIRouter(prefix="/api/pdf", tags=["pdf"])


def period_label(start, end):
    y = current_year()
    if not start:
        start = f"{y}-01-01"
    if not end:
        end = datetime.now(timezone.utc).date().isoformat()
    return f"{pdf_utils.format_date_id(start)} s.d. {pdf_utils.format_date_id(end)}"


def filter_rows(rows, start, end, jenis_key, jenis, transaksi, supplier):
    out = []
    for d in rows:
        if start and d["date"] < start:
            continue
        if end and d["date"] > end:
            continue
        if jenis and d.get(jenis_key) != jenis:
            continue
        if transaksi and d.get("jenis_transaksi") != transaksi:
            continue
        if supplier and supplier.lower() not in (d.get("supplier") or "").lower():
            continue
        out.append(d)
    out.sort(key=lambda x: (x["date"], x.get("created_at", "")))
    return out


def pdf_response(data, filename):
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/paper-mutations")
async def pdf_paper(start: Optional[str] = None, end: Optional[str] = None, jenis: Optional[str] = None,
                    transaksi: Optional[str] = None, supplier: Optional[str] = None,
                    current=Depends(get_current_user)):
    rows = await all_year("paper_mutations", current_year())
    rows = filter_rows(rows, start, end, "jenis_kertas", jenis, transaksi, supplier)
    data = pdf_utils.paper_mutations_pdf(rows, period_label(start, end))
    return pdf_response(data, "laporan-mutasi-kertas.pdf")


@router.get("/ink-mutations")
async def pdf_ink(start: Optional[str] = None, end: Optional[str] = None, jenis: Optional[str] = None,
                  transaksi: Optional[str] = None, supplier: Optional[str] = None,
                  current=Depends(get_current_user)):
    rows = await all_year("ink_mutations", current_year())
    rows = filter_rows(rows, start, end, "jenis_tinta", jenis, transaksi, supplier)
    data = pdf_utils.ink_mutations_pdf(rows, period_label(start, end))
    return pdf_response(data, "laporan-mutasi-tinta.pdf")


@router.get("/other-mutations")
async def pdf_other(start: Optional[str] = None, end: Optional[str] = None, jenis: Optional[str] = None,
                    transaksi: Optional[str] = None, supplier: Optional[str] = None,
                    current=Depends(get_current_user)):
    rows = await all_year("other_mutations", current_year())
    rows = filter_rows(rows, start, end, "nama_barang", jenis, transaksi, supplier)
    data = pdf_utils.other_mutations_pdf(rows, period_label(start, end))
    return pdf_response(data, "laporan-mutasi-lain.pdf")


@router.get("/stock-ringkas")
async def pdf_stock_ringkas(current=Depends(get_current_user)):
    stock = await compute_stock()
    data = pdf_utils.stock_summary_pdf(stock, f"Tahun {current_year()}")
    return pdf_response(data, "laporan-stok-ringkas.pdf")


@router.get("/detail")
async def pdf_detail(start: Optional[str] = None, end: Optional[str] = None,
                     current=Depends(require_section_access)):
    detail = await compute_detail(start, end)
    data = pdf_utils.detail_report_pdf(detail, period_label(start, end))
    return pdf_response(data, "laporan-detail.pdf")


@router.get("/stock-nominal")
async def pdf_stock_nominal(start: Optional[str] = None, end: Optional[str] = None,
                            current=Depends(require_section_access)):
    stock = await compute_stock()
    detail = await compute_detail(start, end)
    data = pdf_utils.stock_summary_pdf(stock, period_label(start, end), detail=detail)
    return pdf_response(data, "laporan-stok-keseluruhan.pdf")
