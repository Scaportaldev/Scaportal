import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  ArrowUpDown, Download, FileText, Plus, Search, Settings2, ShieldCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import * as tapi from "@/lib/tempoApi";
import { apiError } from "@/context/AuthContext";
import { formatRp } from "@/lib/format";
import { dueBucket, formatDateShort, rowTint } from "@/lib/tempoFormat";
import PageContainer from "@/components/layout/PageContainer";
import TablePagination from "@/components/TablePagination";
import { StatusBadge, DueBadge } from "@/components/tempo/StatusBadge";
import InvoiceForm from "@/components/tempo/InvoiceForm";
import InvoiceDetail from "@/components/tempo/InvoiceDetail";
import TopOptionsManager from "@/components/tempo/TopOptionsManager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const DUE_FILTERS = [
  { value: "all", label: "Semua" },
  { value: "overdue", label: "Lewat Tempo" },
  { value: "soon", label: "≤ 3 hari" },
  { value: "week", label: "≤ 7 hari" },
];

const SORT_LABELS = {
  due_date: "Jatuh Tempo",
  invoice_date: "Tanggal Invoice",
  total_amount: "Nominal",
  client_name: "Nama Klien",
  remaining_amount: "Sisa Tagihan",
};

export default function TempoInvoices() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [topOpen, setTopOpen] = useState(false);

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => setDebSearch(search), 250);
    return () => clearTimeout(h);
  }, [search]);

  const { data: topOptions = [], refetch: refetchTop } = useQuery({
    queryKey: ["tempo", "top-options"],
    queryFn: tapi.getTopOptions,
    refetchOnMount: "always",
  });

  const params = useMemo(() => {
    const p = { sort_by: sortBy, order };
    if (debSearch) p.search = debSearch;
    if (statusFilter !== "all") p.status = statusFilter;
    return p;
  }, [debSearch, statusFilter, sortBy, order]);

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ["tempo", "invoices", params],
    queryFn: () => tapi.getInvoices(params),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (error) toast.error(apiError(error, "Gagal memuat invoice"));
  }, [error]);

  const reload = () => queryClient.invalidateQueries({ queryKey: ["tempo"] });

  const filtered = useMemo(() => {
    if (dueFilter === "all") return invoices;
    return invoices.filter((inv) => {
      if (inv.status === "lunas") return false;
      const b = dueBucket(inv.due_date, inv.status);
      if (dueFilter === "overdue") return b === "overdue";
      if (dueFilter === "soon") return b === "soon";
      if (dueFilter === "week") return b === "soon" || b === "warning";
      return true;
    });
  }, [invoices, dueFilter]);

  useEffect(() => { setPage(1); }, [params, dueFilter]);

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const summary = useMemo(() => {
    const totalNilai = invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const totalSisa = invoices.reduce(
      (s, i) => s + (i.status !== "lunas" ? Number(i.remaining_amount) || 0 : 0),
      0,
    );
    const overdue = invoices.filter((i) => dueBucket(i.due_date, i.status) === "overdue").length;
    return { count: invoices.length, totalNilai, totalSisa, overdue };
  }, [invoices]);

  const handleSort = (col) => {
    if (sortBy === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setOrder("asc"); }
  };

  const toggleStatus = async (inv) => {
    const next = inv.status === "lunas" ? "belum_lunas" : "lunas";
    try {
      const updated = await tapi.setInvoiceStatus(inv.id, next);
      toast.success(`Status diubah menjadi ${next === "lunas" ? "Lunas" : "Belum Lunas"}`);
      if (detail?.id === inv.id) setDetail(updated);
      reload();
    } catch (e) {
      toast.error(apiError(e, "Gagal mengubah status"));
    }
  };

  const handleDeleteInvoice = async (inv) => {
    if (!inv) return;
    try {
      await tapi.deleteInvoice(inv.id);
      setDetail(null);
      toast.success("Invoice dihapus");
      reload();
    } catch (e) {
      toast.error(apiError(e, "Gagal menghapus invoice"));
    }
  };

  const doExport = async () => {
    if (invoices.length === 0) return toast.error("Tidak ada data untuk diexport");
    setBusy(true);
    try {
      await tapi.exportInvoicesPdf(params);
      toast.success("PDF diunduh");
    } catch (e) {
      toast.error(apiError(e, "Gagal export PDF"));
    } finally { setBusy(false); }
  };

  const doBackup = async () => {
    if (invoices.length === 0) return toast.error("Tidak ada data untuk di-backup");
    setBusy(true);
    try {
      await tapi.exportInvoicesPdf({});
      setHasBackup(true);
      toast.success("Backup PDF berhasil diunduh");
    } catch (e) {
      toast.error(apiError(e, "Gagal membuat backup"));
    } finally { setBusy(false); }
  };

  const doDeleteAll = async () => {
    setBusy(true);
    try {
      await tapi.deleteAllInvoices();
      setDeleteAllOpen(false);
      setHasBackup(false);
      toast.success("Semua data invoice telah dihapus");
      reload();
    } catch (e) {
      toast.error(apiError(e, "Gagal menghapus data"));
    } finally { setBusy(false); }
  };

  const Th = ({ children, col, className = "" }) => (
    <TableHead className={className}>
      <button type="button" onClick={() => handleSort(col)} data-testid={`sort-${col}`}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", sortBy === col && "text-foreground")}>
        {children} <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <PageContainer
      testid="tempo-invoices-page"
      fillHeight
      pageTitle="Jatuh Tempo Klien"
      pageDescription={`${summary.count} invoice · Piutang ${formatRp(summary.totalSisa)}${summary.overdue ? ` · ${summary.overdue} lewat tempo` : ""}`}
      pageHeaderAction={(
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-full gap-2" onClick={() => setTopOpen(true)}
            data-testid="manage-top-btn">
            <Settings2 className="h-4 w-4" /> Opsi TOP
          </Button>
          <Button variant="outline" className="rounded-full gap-2" onClick={doExport} disabled={busy}
            data-testid="export-all-pdf-btn">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="ghost" className="rounded-full gap-2 text-destructive hover:bg-destructive/10"
            onClick={() => { setHasBackup(false); setDeleteAllOpen(true); }} data-testid="delete-all-btn">
            <Trash2 className="h-4 w-4" /> Hapus Semua
          </Button>
          <Button className="rounded-full gap-2" onClick={() => { setEditing(null); setFormOpen(true); }}
            data-testid="add-invoice-btn">
            <Plus className="h-4 w-4" /> Tambah Invoice
          </Button>
        </div>
      )}
    >
      <Card className="flex shrink-0 flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari klien / no. invoice / no. PO..." data-testid="tempo-search-input"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="tempo-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="belum_lunas">Belum Lunas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setOrder("asc"); }}>
            <SelectTrigger className="w-[180px]" data-testid="tempo-sort-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-1.5" data-testid="tempo-order-toggle"
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}>
            <ArrowUpDown className="h-3.5 w-3.5" /> {order === "asc" ? "Naik" : "Turun"}
          </Button>
        </div>
      </Card>

      <div className="flex shrink-0 flex-wrap gap-2" data-testid="due-filter-chips">
        {DUE_FILTERS.map((d) => (
          <button key={d.value} type="button" data-testid={`due-chip-${d.value}`}
            onClick={() => setDueFilter(d.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              dueFilter === d.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}>
            {d.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card className="rounded-2xl p-4" data-testid="tempo-loading">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl py-16" data-testid="tempo-empty">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>{invoices.length === 0 ? "Belum ada invoice" : "Tidak ada invoice yang cocok"}</EmptyTitle>
              <EmptyDescription>
                {invoices.length === 0
                  ? "Tambahkan invoice pertama untuk mulai memantau jatuh tempo & piutang klien."
                  : "Coba ubah kata kunci, status, atau filter jatuh tempo."}
              </EmptyDescription>
            </EmptyHeader>
            {invoices.length === 0 && (
              <EmptyContent>
                <Button className="mt-1 gap-2 rounded-full" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus className="h-4 w-4" /> Tambah Invoice
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden flex-col overflow-hidden rounded-2xl p-0 md:flex md:min-h-0 md:flex-1">
            <div className="min-h-0 flex-1 overflow-auto">
              <Table data-testid="tempo-table">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <Th col="client_name">Klien</Th>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>TOP</TableHead>
                    <Th col="due_date">Jatuh Tempo</Th>
                    <Th col="total_amount" className="text-right">Total</Th>
                    <Th col="remaining_amount" className="text-right">Sisa</Th>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((inv) => (
                    <TableRow key={inv.id} data-testid={`invoice-row-${inv.id}`}
                      onClick={() => setDetail(inv)}
                      className={cn("cursor-pointer", rowTint(inv))}>
                      <TableCell className="font-medium">{inv.client_name}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.invoice_number || "-"}</TableCell>
                      <TableCell>
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{inv.top}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {formatDateShort(inv.due_date)}
                          <DueBadge dueDate={inv.due_date} status={inv.status} />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium [font-variant-numeric:tabular-nums]">
                        {formatRp(inv.total_amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right [font-variant-numeric:tabular-nums]">
                        {inv.status === "lunas"
                          ? <span className="text-muted-foreground">-</span>
                          : <span className="text-rose-600 dark:text-rose-400">{formatRp(inv.remaining_amount)}</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Hapus invoice"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          data-testid={`row-delete-${inv.id}`}
                          onClick={(e) => { e.stopPropagation(); setPendingDelete(inv); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={page} pageSize={pageSize} total={filtered.length}
              onPageChange={setPage} onPageSizeChange={(v) => { setPageSize(v); setPage(1); }} />
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {pageRows.map((inv) => (
              <Card key={inv.id} data-testid={`invoice-card-${inv.id}`} role="button" tabIndex={0}
                onClick={() => setDetail(inv)}
                className={cn("cursor-pointer rounded-2xl p-4 active:scale-[0.99]", rowTint(inv))}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-bold">{inv.client_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{inv.invoice_number || "-"} · {inv.top}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={inv.status} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      data-testid={`card-delete-${inv.id}`}
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(inv); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Jatuh Tempo</div>
                    <div className="flex items-center gap-2 text-sm">
                      {formatDateShort(inv.due_date)} <DueBadge dueDate={inv.due_date} status={inv.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold [font-variant-numeric:tabular-nums]">{formatRp(inv.total_amount)}</div>
                    {inv.status !== "lunas" && (
                      <div className="text-xs text-rose-600 dark:text-rose-400">Sisa {formatRp(inv.remaining_amount)}</div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            <TablePagination page={page} pageSize={pageSize} total={filtered.length}
              onPageChange={setPage} onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              className="rounded-2xl border" />
          </div>
        </>
      )}

      <InvoiceForm open={formOpen} onOpenChange={setFormOpen} invoice={editing}
        topOptions={topOptions} refetchTop={refetchTop} onSaved={reload} />

      <InvoiceDetail open={!!detail} onOpenChange={(v) => !v && setDetail(null)} invoice={detail}
        onEdit={(inv) => { setEditing(inv); setFormOpen(true); }}
        onToggleStatus={toggleStatus} onDelete={handleDeleteInvoice} />

      <TopOptionsManager open={topOpen} onOpenChange={setTopOpen} onChanged={() => { refetchTop(); reload(); }} />

      {/* Hapus 1 invoice */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-2xl" data-testid="row-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus Invoice Ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Invoice <b>{pendingDelete?.client_name}</b>
              {pendingDelete?.invoice_number ? ` (${pendingDelete.invoice_number})` : ""} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full" data-testid="row-delete-cancel">Batal</AlertDialogCancel>
            <Button className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="row-delete-confirm"
              onClick={() => { const inv = pendingDelete; setPendingDelete(null); handleDeleteInvoice(inv); }}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hapus semua — wajib backup PDF dulu */}
      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent className="rounded-2xl" data-testid="delete-all-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus Semua Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini menghapus <b>seluruh invoice</b> secara permanen. Untuk keamanan, Anda wajib
              mengunduh backup PDF terlebih dahulu sebelum tombol hapus aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className={cn(
            "flex items-center gap-2 rounded-xl border p-3 text-sm",
            hasBackup
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-border bg-secondary text-muted-foreground",
          )}>
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {hasBackup ? "Backup PDF sudah diunduh. Tombol hapus aktif." : "Backup PDF belum diunduh."}
          </div>

          <Button variant="secondary" className="rounded-full" data-testid="backup-pdf-btn"
            disabled={busy} onClick={doBackup}>
            <Download className="mr-1.5 h-4 w-4" /> Download Backup PDF
          </Button>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full" data-testid="delete-all-cancel-btn">Batal</AlertDialogCancel>
            <Button disabled={!hasBackup || busy} data-testid="confirm-delete-all-btn"
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              onClick={doDeleteAll}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Hapus Semua Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
