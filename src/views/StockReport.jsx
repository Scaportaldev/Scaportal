import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Filter, Inbox } from "lucide-react";
import { toast } from "sonner";
import api, { downloadPdf } from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import { formatNumber } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import MutasiTable from "@/components/MutasiTable";
import PageContainer from "@/components/layout/PageContainer";

export default function StockReport() {
  const { perms } = useAuth();
  const [fSupplier, setFSupplier] = useState("all");

  // Cache react-query: tampil instan dari cache, refresh otomatis di background.
  const { data, error } = useQuery({
    queryKey: ["reports", "stock"],
    queryFn: async () => (await api.get("/reports/stock")).data,
    refetchOnMount: "always",
  });
  useEffect(() => { if (error) toast.error(apiError(error)); }, [error]);

  const dl = async (path, name) => {
    try { await downloadPdf(path, {}, name); toast.success("PDF diunduh."); }
    catch (e) { toast.error(apiError(e, "Gagal unduh PDF")); }
  };

  const suppliers = useMemo(() => {
    const set = new Set();
    (data?.paper || []).forEach((p) => (p.suppliers || []).forEach((s) => set.add(s.supplier)));
    (data?.ink || []).forEach((p) => (p.suppliers || []).forEach((s) => set.add(s.supplier)));
    (data?.other || []).forEach((p) => (p.suppliers || []).forEach((s) => set.add(s.supplier)));
    return Array.from(set).sort();
  }, [data]);

  const supStock = (item, sup) => (item.suppliers || []).find((s) => s.supplier === sup)?.stock || 0;
  const filtered = fSupplier !== "all";

  const paperRows = useMemo(() => {
    if (!data) return [];
    return filtered ? data.paper.filter((p) => supStock(p, fSupplier) !== 0) : data.paper;
  }, [data, fSupplier, filtered]);

  const inkRows = useMemo(() => {
    if (!data) return [];
    return filtered ? data.ink.filter((p) => supStock(p, fSupplier) !== 0) : data.ink;
  }, [data, fSupplier, filtered]);

  const otherRows = useMemo(() => {
    if (!data) return [];
    return filtered ? (data.other || []).filter((p) => supStock(p, fSupplier) !== 0) : (data.other || []);
  }, [data, fSupplier, filtered]);

  const paperTotal = useMemo(() => filtered ? paperRows.reduce((a, p) => a + supStock(p, fSupplier), 0) : (data?.paper || []).reduce((a, p) => a + Math.max(p.stock, 0), 0), [paperRows, fSupplier, filtered, data]);
  const inkTotal = useMemo(() => filtered ? inkRows.reduce((a, p) => a + supStock(p, fSupplier), 0) : (data?.ink || []).reduce((a, p) => a + Math.max(p.stock, 0), 0), [inkRows, fSupplier, filtered, data]);

  const badges = (item) => {
    const list = filtered ? (item.suppliers || []).filter((s) => s.supplier === fSupplier) : (item.suppliers || []);
    return list.length ? list.map((s, j) => (
      <span key={j} className="whitespace-nowrap rounded bg-secondary px-1.5 py-0.5 text-[11px]">
        {s.supplier}: <b>{formatNumber(s.stock)}</b>
      </span>
    )) : <span className="text-xs text-muted-foreground">-</span>;
  };

  // Kolom bersama untuk ketiga tabel stok (dipakai MutasiTable).
  const supplierCol = {
    id: "supplier",
    label: filtered ? "Stok Supplier" : "Per Supplier",
    cardClassName: "col-span-2 flex-col items-stretch gap-1",
    render: (p) => <div className="flex flex-wrap gap-1">{badges(p)}</div>,
    cardRender: (p) => <div className="flex flex-wrap justify-end gap-1 pt-0.5">{badges(p)}</div>,
  };
  const totalCol = (unit) => ({
    id: "total",
    label: filtered ? "Stok Supplier" : "Total Stok",
    role: "status",
    align: "right",
    cellClassName: "font-semibold",
    render: (p) => (
      <span className="whitespace-nowrap font-semibold tabular-nums">
        {formatNumber(filtered ? supStock(p, fSupplier) : p.stock)} {unit ?? p.satuan ?? ""}
      </span>
    ),
  });

  return (
    <PageContainer
      testid="stock-report-page"
      pageTitle="Laporan Stok Ringkas"
      pageDescription={`Rekap stok saat ini (tanpa nominal) — tahun ${data?.year || ""}.`}
      pageHeaderAction={perms.canStokPdf && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" data-testid="pdf-paper-mutations" onClick={() => dl("/pdf/paper-mutations", "laporan-mutasi-kertas.pdf")}>
            <FileDown className="h-4 w-4" /> Mutasi Kertas
          </Button>
          <Button variant="outline" className="gap-2" data-testid="pdf-ink-mutations" onClick={() => dl("/pdf/ink-mutations", "laporan-mutasi-tinta.pdf")}>
            <FileDown className="h-4 w-4" /> Mutasi Tinta
          </Button>
          <Button variant="outline" className="gap-2" data-testid="pdf-other-mutations" onClick={() => dl("/pdf/other-mutations", "laporan-mutasi-lain.pdf")}>
            <FileDown className="h-4 w-4" /> Mutasi Lain
          </Button>
          <Button variant="outline" className="gap-2" data-testid="pdf-stock-ringkas" onClick={() => dl("/pdf/stock-ringkas", "laporan-stok-ringkas.pdf")}>
            <FileDown className="h-4 w-4" /> Stok Ringkas
          </Button>
        </div>
      )}
    >

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs"><Filter className="h-3.5 w-3.5" /> Filter Supplier</Label>
            <Select value={fSupplier} onValueChange={setFSupplier}>
              <SelectTrigger className="w-[220px]" data-testid="filter-supplier-stock"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Supplier</SelectItem>
                {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filtered && (
            <div className="flex flex-wrap gap-4" data-testid="supplier-summary">
              <div className="rounded-md border border-border px-4 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Stok Kertas • {fSupplier}</div>
                <div className="font-display text-xl font-bold">{formatNumber(paperTotal)} Rim</div>
              </div>
              <div className="rounded-md border border-border px-4 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Stok Tinta • {fSupplier}</div>
                <div className="font-display text-xl font-bold">{formatNumber(inkTotal)} Kg</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <StockSection title="Stok Kertas (Rim)" testid="paper-stock-table" data={paperRows}
          columns={[
            { id: "jenis", label: "Jenis", role: "name", cellClassName: "font-medium", render: (p) => p.jenis_kertas },
            { id: "gram", label: "Gramatur", render: (p) => formatNumber(p.gramatur) },
            { id: "ukuran", label: "Ukuran", cellClassName: "whitespace-nowrap", render: (p) => `${formatNumber(p.panjang)}x${formatNumber(p.lebar)} cm` },
            supplierCol,
            totalCol("Rim"),
          ]}
        />
        <StockSection title="Stok Tinta (Kg)" testid="ink-stock-table" data={inkRows}
          columns={[
            { id: "jenis", label: "Jenis Tinta", role: "name", cellClassName: "font-medium", render: (p) => p.jenis_tinta },
            supplierCol,
            totalCol("Kg"),
          ]}
        />
      </div>

      <StockSection title="Stok Lain" testid="other-stock-table" data={otherRows}
        columns={[
          { id: "nama", label: "Nama Barang", role: "name", cellClassName: "font-medium", render: (p) => p.nama_barang },
          { id: "satuan", label: "Satuan", render: (p) => p.satuan || "-" },
          supplierCol,
          totalCol(),
        ]}
      />
    </PageContainer>
  );
}

/** Seksi tabel stok: desktop = Card + tabel, mobile = judul + list kartu (via MutasiTable). */
function StockSection({ title, columns, data, testid }) {
  return (
    <section
      className="flex flex-col gap-3 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:border-border/70 md:bg-card md:text-card-foreground md:shadow-soft"
      data-testid={`${testid}-section`}
    >
      <h3 className="font-display text-lg font-bold md:border-b md:border-border md:px-5 md:py-3">{title}</h3>
      <MutasiTable
        columns={columns}
        data={data}
        rowKey={(_, i) => i}
        scrollClassName="overflow-x-auto"
        testid={testid}
        empty={{ icon: <Inbox />, title: "Belum ada data stok", description: "Data muncul setelah ada mutasi masuk." }}
      />
    </section>
  );
}
