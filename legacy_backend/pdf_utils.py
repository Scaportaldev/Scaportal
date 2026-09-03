import io
from datetime import datetime, timezone
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage,
)

ID_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"]

PRIMARY = colors.HexColor("#2563eb")
HEADER_BG = colors.HexColor("#1e293b")
LIGHT = colors.HexColor("#f1f5f9")


def format_rp(n):
    try:
        n = float(n or 0)
    except Exception:
        n = 0
    return "Rp " + f"{int(round(n)):,}".replace(",", ".")


def format_num(n):
    n = float(n or 0)
    if n == int(n):
        return f"{int(n):,}".replace(",", ".")
    return f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_date_id(iso):
    if not iso:
        return "-"
    try:
        d = datetime.fromisoformat(iso[:10])
        return f"{d.day} {ID_MONTHS[d.month - 1]} {d.year}"
    except Exception:
        return iso


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleBig", fontName="Helvetica-Bold", fontSize=16, textColor=HEADER_BG, spaceAfter=4))
    styles.add(ParagraphStyle(name="Sub", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#64748b"), spaceAfter=2))
    styles.add(ParagraphStyle(name="Sec", fontName="Helvetica-Bold", fontSize=12, textColor=PRIMARY, spaceBefore=12, spaceAfter=6))
    styles.add(ParagraphStyle(name="Cell", fontName="Helvetica", fontSize=8))
    return styles


def _header(title, period_label, styles):
    now = datetime.now(timezone.utc)
    elems = [
        Paragraph("StokKu — Laporan Stok Kertas & Tinta", styles["Sub"]),
        Paragraph(title, styles["TitleBig"]),
        Paragraph(f"Periode: {period_label}", styles["Sub"]),
        Paragraph(f"Tanggal cetak: {format_date_id(now.isoformat())}", styles["Sub"]),
        Spacer(1, 10),
    ]
    return elems


def _table(header, data_rows, col_widths=None, right_cols=None):
    right_cols = right_cols or []
    table_data = [header] + data_rows
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for c in right_cols:
        style.append(("ALIGN", (c, 1), (c, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return t


TRX_LABEL = {"masuk": "Masuk", "keluar": "Keluar", "retur": "Retur/Sisa"}
MODE_LABEL = {"per_rim": "Per Rim", "per_kg": "Per Kg", "total": "Total Kiriman"}


def paper_mutations_pdf(rows, period_label):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=1.2 * cm, bottomMargin=1 * cm,
                            leftMargin=1 * cm, rightMargin=1 * cm)
    styles = _styles()
    elems = _header("Laporan Mutasi Stok Kertas", period_label, styles)
    header = ["Tanggal", "Kode", "Jenis Kertas", "Gram", "Ukuran", "Transaksi", "Jumlah (Rim)",
              "Supplier", "PIC", "Mode", "Harga/Rim", "PPN"]
    data = []
    for m in rows:
        data.append([
            format_date_id(m.get("date")), m.get("kode", "") or "-", m.get("jenis_kertas", ""), format_num(m.get("gramatur")),
            f"{format_num(m.get('panjang'))}x{format_num(m.get('lebar'))}", TRX_LABEL.get(m.get("jenis_transaksi"), ""),
            format_num(m.get("jumlah")), m.get("supplier", "") or "-", m.get("pic_name", ""),
            MODE_LABEL.get(m.get("price_mode"), "-") if m.get("jenis_transaksi") == "masuk" else "-",
            format_rp(m.get("harga_per_rim")) if m.get("jenis_transaksi") == "masuk" else "-",
            format_rp(m.get("ppn_nominal")) if m.get("ppn_ada") else "-",
        ])
    if not data:
        data = [["-"] * len(header)]
    elems.append(_table(header, data, right_cols=[6, 10, 11]))
    doc.build(elems)
    buf.seek(0)
    return buf.read()


def ink_mutations_pdf(rows, period_label):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=1.2 * cm, bottomMargin=1 * cm,
                            leftMargin=1 * cm, rightMargin=1 * cm)
    styles = _styles()
    elems = _header("Laporan Mutasi Stok Tinta", period_label, styles)
    header = ["Tanggal", "Kode", "Jenis Tinta", "Transaksi", "Jumlah (Kg)", "Supplier", "PIC", "Harga/Kg", "PPN"]
    data = []
    for m in rows:
        data.append([
            format_date_id(m.get("date")), m.get("kode", "") or "-", m.get("jenis_tinta", ""), TRX_LABEL.get(m.get("jenis_transaksi"), ""),
            format_num(m.get("jumlah")), m.get("supplier", "") or "-", m.get("pic_name", ""),
            format_rp(m.get("harga_per_kg")) if m.get("jenis_transaksi") == "masuk" else "-",
            format_rp(m.get("ppn_nominal")) if m.get("ppn_ada") else "-",
        ])
    if not data:
        data = [["-"] * len(header)]
    elems.append(_table(header, data, right_cols=[4, 7, 8]))
    doc.build(elems)
    buf.seek(0)
    return buf.read()


def other_mutations_pdf(rows, period_label):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=1.2 * cm, bottomMargin=1 * cm,
                            leftMargin=1 * cm, rightMargin=1 * cm)
    styles = _styles()
    elems = _header("Laporan Mutasi Stok Lain", period_label, styles)
    header = ["Tanggal", "Kode", "Nama Barang", "Satuan", "Transaksi", "Jumlah", "Supplier", "PIC", "Harga/Satuan", "PPN"]
    data = []
    for m in rows:
        data.append([
            format_date_id(m.get("date")), m.get("kode", "") or "-", m.get("nama_barang", ""), m.get("satuan", "") or "-",
            TRX_LABEL.get(m.get("jenis_transaksi"), ""), format_num(m.get("jumlah")), m.get("supplier", "") or "-",
            m.get("pic_name", ""), format_rp(m.get("harga_per_satuan")) if m.get("jenis_transaksi") == "masuk" else "-",
            format_rp(m.get("ppn_nominal")) if m.get("ppn_ada") else "-",
        ])
    if not data:
        data = [["-"] * len(header)]
    elems.append(_table(header, data, right_cols=[5, 8, 9]))
    doc.build(elems)
    buf.seek(0)
    return buf.read()


def _fig_to_image(fig, width_cm):
    b = io.BytesIO()
    fig.savefig(b, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    b.seek(0)
    img = RLImage(b)
    ratio = img.imageHeight / img.imageWidth
    img.drawWidth = width_cm * cm
    img.drawHeight = width_cm * cm * ratio
    return img


def stock_summary_pdf(stock, period_label, detail=None):
    """detail = report detail dict for nominal version; if None -> ringkas."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.2 * cm, bottomMargin=1 * cm,
                            leftMargin=1.2 * cm, rightMargin=1.2 * cm)
    styles = _styles()
    title = "Laporan Stok Keseluruhan" if detail else "Laporan Stok Ringkas"
    elems = _header(title, period_label, styles)

    def sup_str(item):
        return ", ".join(f"{s['supplier']}: {format_num(s['stock'])}" for s in item.get("suppliers", [])) or "-"

    elems.append(Paragraph("Rekap Stok Kertas", styles["Sec"]))
    ph = ["Jenis Kertas", "Gramatur", "Ukuran (cm)", "Per Supplier", "Stok (Rim)"]
    pd = [[p["jenis_kertas"], format_num(p["gramatur"]), f"{format_num(p['panjang'])}x{format_num(p['lebar'])}",
           sup_str(p), format_num(p["stock"])] for p in stock.get("paper", [])]
    if not pd:
        pd = [["-", "-", "-", "-", "-"]]
    elems.append(_table(ph, pd, right_cols=[4]))

    elems.append(Paragraph("Rekap Stok Tinta", styles["Sec"]))
    ih = ["Jenis Tinta", "Per Supplier", "Stok (Kg)"]
    idata = [[i["jenis_tinta"], sup_str(i), format_num(i["stock"])] for i in stock.get("ink", [])]
    if not idata:
        idata = [["-", "-", "-"]]
    elems.append(_table(ih, idata, right_cols=[2]))

    elems.append(Paragraph("Rekap Stok Lain", styles["Sec"]))
    oh = ["Nama Barang", "Satuan", "Per Supplier", "Stok"]
    odata = [[o["nama_barang"], o.get("satuan", "") or "-", sup_str(o), format_num(o["stock"])] for o in stock.get("other", [])]
    if not odata:
        odata = [["-", "-", "-", "-"]]
    elems.append(_table(oh, odata, right_cols=[3]))

    if detail:
        elems.append(Paragraph("Nilai Nominal Stok (Rupiah)", styles["Sec"]))
        nh = ["Kategori", "Nominal"]
        nd = [["Stok Kertas", format_rp(detail["nominal_paper"])],
              ["Stok Tinta", format_rp(detail["nominal_ink"])],
              ["Stok Lain", format_rp(detail.get("nominal_other", 0))],
              ["TOTAL", format_rp(detail["nominal_total"])]]
        elems.append(_table(nh, nd, right_cols=[1]))

        # composition pie
        comp = detail.get("paper_composition", []) + []
        if detail.get("paper_composition"):
            fig, ax = plt.subplots(figsize=(4, 3))
            ax.pie([c["value"] for c in detail["paper_composition"]],
                   labels=[c["name"] for c in detail["paper_composition"]], autopct="%1.0f%%", textprops={"fontsize": 7})
            ax.set_title("Komposisi Nominal Kertas", fontsize=9)
            elems.append(Spacer(1, 8))
            elems.append(_fig_to_image(fig, 9))

        # monthly value line
        mv = detail.get("monthly_value", [])
        if mv:
            fig, ax = plt.subplots(figsize=(6, 2.6))
            ax.plot([m["label"] for m in mv], [m["total"] for m in mv], marker="o", color="#2563eb")
            ax.set_title("Tren Nilai Stok per Bulan (Rp)", fontsize=9)
            ax.tick_params(labelsize=7)
            ax.grid(alpha=0.3)
            elems.append(Spacer(1, 8))
            elems.append(_fig_to_image(fig, 15))

        # PPN monthly
        elems.append(Paragraph("Total PPN Dibayarkan per Bulan", styles["Sec"]))
        ppnh = ["Bulan", "PPN Kertas", "PPN Tinta", "Total"]
        ppnd = [[p["label"], format_rp(p["paper"]), format_rp(p["ink"]), format_rp(p["total"])]
                for p in detail.get("ppn_monthly", [])]
        ppnd.append(["TOTAL TAHUN", "", "", format_rp(detail.get("ppn_total_year", 0))])
        elems.append(_table(ppnh, ppnd, right_cols=[1, 2, 3]))

    doc.build(elems)
    buf.seek(0)
    return buf.read()


def detail_report_pdf(detail, period_label):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.2 * cm, bottomMargin=1 * cm,
                            leftMargin=1.2 * cm, rightMargin=1.2 * cm)
    styles = _styles()
    elems = _header("Laporan Detail (Nominal & Grafik)", period_label, styles)

    nh = ["Kategori", "Nominal Stok"]
    nd = [["Stok Kertas", format_rp(detail["nominal_paper"])],
          ["Stok Tinta", format_rp(detail["nominal_ink"])],
          ["Stok Lain", format_rp(detail.get("nominal_other", 0))],
          ["TOTAL", format_rp(detail["nominal_total"])]]
    elems.append(_table(nh, nd, right_cols=[1]))

    cmp = detail.get("comparison", {})
    elems.append(Paragraph("Perbandingan dengan Periode Sebelumnya", styles["Sec"]))
    ch = ["Metrik", "Periode Ini", "Periode Lalu", "Selisih", "%"]
    cd = [
        ["Nominal Kertas", format_rp(cmp["paper_nominal"]["current"]), format_rp(cmp["paper_nominal"]["prev"]),
         format_rp(cmp["paper_nominal"]["diff"]), f"{cmp['paper_nominal']['pct']}%"],
        ["Nominal Tinta", format_rp(cmp["ink_nominal"]["current"]), format_rp(cmp["ink_nominal"]["prev"]),
         format_rp(cmp["ink_nominal"]["diff"]), f"{cmp['ink_nominal']['pct']}%"],
        ["Mutasi Masuk Kertas", cmp["paper_masuk"]["current"], cmp["paper_masuk"]["prev"], "", ""],
        ["Mutasi Keluar Kertas", cmp["paper_keluar"]["current"], cmp["paper_keluar"]["prev"], "", ""],
        ["Mutasi Masuk Tinta", cmp["ink_masuk"]["current"], cmp["ink_masuk"]["prev"], "", ""],
        ["Mutasi Keluar Tinta", cmp["ink_keluar"]["current"], cmp["ink_keluar"]["prev"], "", ""],
    ]
    elems.append(_table(ch, cd, right_cols=[1, 2, 3, 4]))

    mt = detail.get("monthly_trend", [])
    if mt:
        fig, ax = plt.subplots(figsize=(6, 2.8))
        labels = [m["label"] for m in mt]
        ax.plot(labels, [m["paper_masuk"] for m in mt], marker="o", label="Kertas Masuk", color="#2563eb")
        ax.plot(labels, [m["paper_keluar"] for m in mt], marker="o", label="Kertas Keluar", color="#f43f5e")
        ax.set_title("Tren Mutasi Kertas (Rim)", fontsize=9)
        ax.legend(fontsize=7)
        ax.tick_params(labelsize=7)
        ax.grid(alpha=0.3)
        elems.append(Spacer(1, 8))
        elems.append(_fig_to_image(fig, 15))

    mv = detail.get("monthly_value", [])
    if mv:
        fig, ax = plt.subplots(figsize=(6, 2.6))
        ax.bar([m["label"] for m in mv], [m["total"] for m in mv], color="#0ea5e9")
        ax.set_title("Nilai Total Stok per Bulan (Rp)", fontsize=9)
        ax.tick_params(labelsize=7)
        elems.append(Spacer(1, 8))
        elems.append(_fig_to_image(fig, 15))

    elems.append(Paragraph("Total PPN Dibayarkan per Bulan", styles["Sec"]))
    ppnh = ["Bulan", "PPN Kertas", "PPN Tinta", "Total"]
    ppnd = [[p["label"], format_rp(p["paper"]), format_rp(p["ink"]), format_rp(p["total"])]
            for p in detail.get("ppn_monthly", [])]
    ppnd.append(["TOTAL TAHUN", "", "", format_rp(detail.get("ppn_total_year", 0))])
    elems.append(_table(ppnh, ppnd, right_cols=[1, 2, 3]))

    ppn_series = detail.get("ppn_monthly", [])
    if ppn_series:
        fig, ax = plt.subplots(figsize=(6, 2.6))
        ax.bar([p["label"][:3] for p in ppn_series], [p["total"] for p in ppn_series], color="#f59e0b")
        ax.set_title("Tren PPN Dibayarkan per Bulan (Rp)", fontsize=9)
        ax.tick_params(labelsize=7)
        elems.append(Spacer(1, 8))
        elems.append(_fig_to_image(fig, 15))

    doc.build(elems)
    buf.seek(0)
    return buf.read()
