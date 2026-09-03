import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, FileDown, History,
} from "lucide-react";
import { toast } from "sonner";

import * as kapi from "@/lib/klienApi";
import { fmtQty } from "@/lib/klienApi";
import { fmtDateTime } from "@/lib/format";
import { apiError } from "@/context/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import TablePagination from "@/components/TablePagination";
import MutasiTable from "@/components/MutasiTable";
import { MutationDialog, ConfirmDeleteDialog } from "@/components/klien/KlienDialogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const INIT = { klien_id: "semua", po_id: "semua", jenis: "semua", start: "", end: "" };

export function MutasiBadge({ jenis }) {
  const masuk = jenis === "masuk";
  return (
    <span
      data-testid="mutasi-badge"
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
        masuk
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
      }`}
    >
      {masuk ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
      {masuk ? "Masuk" : "Keluar"}
    </span>
  );
}

export default function KlienHistory() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(INIT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editMut, setEditMut] = useState(null);
  const [delMut, setDelMut] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { data: kliens = [] } = useQuery({
    queryKey: ["klien", "clients"],
    queryFn: kapi.listKliens,
    refetchOnMount: "always",
  });

  const { data: pos = [] } = useQuery({
    queryKey: ["klien", "pos", filters.klien_id],
    queryFn: () => kapi.listKlienPos({ klien_id: filters.klien_id }),
    enabled: filters.klien_id !== "semua",
  });

  const params = useMemo(() => {
    const p = {};
    if (filters.klien_id !== "semua") p.klien_id = filters.klien_id;
    if (filters.po_id !== "semua") p.po_id = filters.po_id;
    if (filters.jenis !== "semua") p.jenis = filters.jenis;
    if (filters.start) p.start = new Date(`${filters.start}T00:00:00`).toISOString();
    if (filters.end) p.end = new Date(`${filters.end}T23:59:59.999`).toISOString();
    return p;
  }, [filters]);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["klien", "mutations", params],
    queryFn: () => kapi.listKlienMutations(params),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (error) toast.error(apiError(error, "Gagal memuat riwayat"));
  }, [error]);
  useEffect(() => { setPage(1); }, [params]);

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["klien"] });
  }, [queryClient]);

  const set = (k) => (v) =>
    setFilters((f) => {
      const next = { ...f, [k]: v?.target ? v.target.value : v };
      if (k === "klien_id") next.po_id = "semua";
      return next;
    });

  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const doExport = async () => {
    setExporting(true);
    try {
      await kapi.exportKlienRiwayatPdf(params);
      toast.success("Riwayat PDF diunduh");
    } catch (err) {
      toast.error(apiError(err, "Gagal membuat PDF"));
    } finally {
      setExporting(false);
    }
  };

  const totalMasuk = rows.filter((m) => m.jenis === "masuk").length;
  const totalKeluar = rows.length - totalMasuk;

  // Konfigurasi kolom MutasiTable (desktop = tabel, mobile = kartu).
  const columns = [
    { id: "tanggal", label: "Tanggal & Waktu", headClassName: "whitespace-nowrap", cellClassName: "whitespace-nowrap text-muted-foreground", cardClassName: "col-span-2", render: (m) => fmtDateTime(m.tanggal) },
    { id: "klien", label: "Nama Klien", role: "name", cellClassName: "whitespace-nowrap font-medium", render: (m) => m.nama_klien },
    { id: "po", label: "No PO", render: (m) => m.no_po },
    { id: "item", label: "Jenis Item", cellClassName: "whitespace-nowrap", render: (m) => m.jenis_item },
    { id: "mutasi", label: "Mutasi", role: "status", render: (m) => <MutasiBadge jenis={m.jenis} /> },
    {
      id: "jumlah", label: "Jumlah", align: "right",
      cellClassName: "whitespace-nowrap font-semibold [font-variant-numeric:tabular-nums]",
      render: (m) => (
        <span data-testid={`history-qty-${m.id}`}>
          {m.jenis === "masuk" ? "+" : "-"}{fmtQty(m.jumlah)} {m.satuan}
        </span>
      ),
    },
    {
      id: "keterangan", label: "Keterangan", cellClassName: "max-w-[220px] truncate text-muted-foreground", cardClassName: "col-span-2",
      render: (m) => m.keterangan || "-",
      cardRender: (m) => <span className="font-normal text-muted-foreground">{m.keterangan || "-"}</span>,
    },
  ];
  // onDelete hanya membuka ConfirmDeleteDialog — eksekusi hapus terjadi setelah konfirmasi.
  const actions = {
    onEdit: (m) => setEditMut(m),
    onDelete: (m) => setDelMut(m),
    editTestId: (m) => `edit-mutation-btn-${m.id}`,
    deleteTestId: (m) => `delete-mutation-btn-${m.id}`,
  };

  return (
    <PageContainer
      testid="klien-history-page"
      fillHeight
      pageTitle="Riwayat Mutasi Klien"
      pageDescription={`${rows.length} catatan · ${totalMasuk} masuk · ${totalKeluar} keluar — terbaru di atas.`}
      pageHeaderAction={(
        <Button variant="outline" className="rounded-full gap-2" onClick={doExport}
          disabled={exporting} data-testid="klien-history-export">
          <FileDown className="h-4 w-4" /> {exporting ? "Menyiapkan..." : "Export PDF"}
        </Button>
      )}
    >
      <Card className="grid shrink-0 grid-cols-2 items-end gap-3 rounded-2xl p-4 md:grid-cols-3 lg:grid-cols-6"
        data-testid="klien-history-filters">
        <div className="space-y-1.5">
          <Label className="text-xs">Klien</Label>
          <Select value={filters.klien_id} onValueChange={set("klien_id")}>
            <SelectTrigger data-testid="filter-klien-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Klien</SelectItem>
              {kliens.map((k) => (
                <SelectItem key={k.id} value={k.id} data-testid={`filter-klien-${k.id}`}>{k.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">No PO</Label>
          <Select value={filters.po_id} onValueChange={set("po_id")} disabled={filters.klien_id === "semua"}>
            <SelectTrigger data-testid="filter-po-select"><SelectValue placeholder="Semua PO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua PO</SelectItem>
              {pos.map((p) => (
                <SelectItem key={p.id} value={p.id} data-testid={`filter-po-${p.id}`}>{p.no_po}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Jenis Mutasi</Label>
          <Select value={filters.jenis} onValueChange={set("jenis")}>
            <SelectTrigger data-testid="filter-jenis-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua</SelectItem>
              <SelectItem value="masuk" data-testid="filter-jenis-masuk">Masuk</SelectItem>
              <SelectItem value="keluar" data-testid="filter-jenis-keluar">Keluar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Dari Tanggal</Label>
          <Input type="date" value={filters.start} onChange={set("start")} data-testid="filter-start-date" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sampai Tanggal</Label>
          <Input type="date" value={filters.end} onChange={set("end")} data-testid="filter-end-date" />
        </div>
        <Button variant="outline" className="h-10 rounded-full gap-1.5"
          onClick={() => setFilters(INIT)} data-testid="filter-reset-btn">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </Card>

      <div
        className="flex flex-col gap-3 md:gap-0 md:min-h-0 md:flex-1 md:overflow-hidden md:rounded-2xl md:border md:border-border/70 md:bg-card md:text-card-foreground md:shadow-soft"
        data-testid="klien-history-table"
      >
        <MutasiTable
          columns={columns}
          data={pageRows}
          rowKey={(m) => m.id}
          rowTestId={(m) => `history-row-${m.id}`}
          actions={actions}
          isLoading={isLoading}
          skeletonRows={6}
          scrollClassName="overflow-auto md:min-h-0 md:flex-1"
          testid="klien-history-body"
          empty={{
            icon: <History />,
            title: "Belum ada mutasi tercatat",
            description: "Catat mutasi masuk/keluar dari halaman Stok Klien, atau ubah filter di atas.",
          }}
        />
        <TablePagination page={page} pageSize={pageSize} total={rows.length}
          className="max-md:static max-md:rounded-xl max-md:border max-md:border-border/70 max-md:shadow-soft"
          onPageChange={setPage} onPageSizeChange={(v) => { setPageSize(v); setPage(1); }} />
      </div>

      <MutationDialog open={!!editMut} onOpenChange={(o) => !o && setEditMut(null)}
        mutation={editMut} onSaved={reload} />
      <ConfirmDeleteDialog open={!!delMut} onOpenChange={(o) => !o && setDelMut(null)}
        title="Hapus catatan mutasi?"
        description={delMut
          ? `Mutasi ${delMut.jenis} ${fmtQty(delMut.jumlah)} ${delMut.satuan} untuk "${delMut.jenis_item}" akan dihapus dan stok item disesuaikan kembali.`
          : ""}
        onConfirm={() => kapi.deleteKlienMutation(delMut.id)} onDeleted={reload} />
    </PageContainer>
  );
}
