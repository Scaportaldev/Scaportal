import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, RotateCcw, FileDown, History,
} from "lucide-react";
import { toast } from "sonner";

import * as kapi from "@/lib/klienApi";
import { fmtQty } from "@/lib/klienApi";
import { fmtDateTime } from "@/lib/format";
import { apiError } from "@/context/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import TablePagination from "@/components/TablePagination";
import { MutationDialog, ConfirmDeleteDialog } from "@/components/klien/KlienDialogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

      <Card className="flex flex-col overflow-hidden rounded-2xl p-0 md:min-h-0 md:flex-1">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table data-testid="klien-history-table">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="whitespace-nowrap">Tanggal &amp; Waktu</TableHead>
                <TableHead>Nama Klien</TableHead>
                <TableHead>No PO</TableHead>
                <TableHead>Jenis Item</TableHead>
                <TableHead>Mutasi</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14">
                    <Empty data-testid="klien-history-empty">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><History /></EmptyMedia>
                        <EmptyTitle>Belum ada mutasi tercatat</EmptyTitle>
                        <EmptyDescription>
                          Catat mutasi masuk/keluar dari halaman Stok Klien, atau ubah filter di atas.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((m) => (
                  <TableRow key={m.id} data-testid={`history-row-${m.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.tanggal)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{m.nama_klien}</TableCell>
                    <TableCell>{m.no_po}</TableCell>
                    <TableCell className="whitespace-nowrap">{m.jenis_item}</TableCell>
                    <TableCell><MutasiBadge jenis={m.jenis} /></TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold [font-variant-numeric:tabular-nums]"
                      data-testid={`history-qty-${m.id}`}>
                      {m.jenis === "masuk" ? "+" : "-"}{fmtQty(m.jumlah)} {m.satuan}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{m.keterangan || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditMut(m)} data-testid={`edit-mutation-btn-${m.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDelMut(m)} data-testid={`delete-mutation-btn-${m.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={rows.length}
          onPageChange={setPage} onPageSizeChange={(v) => { setPageSize(v); setPage(1); }} />
      </Card>

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
