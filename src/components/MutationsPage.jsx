import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Plus, Search, FileDown, Pencil, Trash2, Link2, Inbox } from "lucide-react";
import { toast } from "sonner";
import api, { downloadPdf } from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import { formatRupiah, formatNumber, formatDateID, todayStr, TRX_LABEL } from "@/lib/format";
import MutationForm from "@/components/MutationForm";
import PeriodFilter from "@/components/PeriodFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import TableSkeleton from "@/components/TableSkeleton";
import PageContainer from "@/components/layout/PageContainer";
import TableViewOptions from "@/components/TableViewOptions";
import TablePagination from "@/components/TablePagination";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const trxBadge = (t) => {
  const map = { masuk: "bg-emerald-500/15 text-emerald-600", keluar: "bg-rose-500/15 text-rose-500", retur: "bg-amber-500/15 text-amber-600" };
  return <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${map[t]}`}>{TRX_LABEL[t]}</span>;
};

const TITLES = { paper: "Kertas", ink: "Tinta", other: "Lain" };

export default function MutationsPage({ type }) {
  const isPaper = type === "paper";
  const isInk = type === "ink";
  const isOther = type === "other";
  const { user } = useAuth();
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [fJenis, setFJenis] = useState("all");
  const [fTrx, setFTrx] = useState("all");
  const [fSupplier, setFSupplier] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [delId, setDelId] = useState(null);
  const [hidden, setHidden] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const base = `/${type}`;
  const nameOf = (m) => isPaper ? m.jenis_kertas : isOther ? m.nama_barang : m.jenis_tinta;
  const unitOf = (m) => isPaper ? "Rim" : isInk ? "Kg" : (m.satuan || "");
  // Mode "Total Kiriman": tampilkan total harga kiriman apa adanya (bukan hasil bagi per rim).
  const priceOf = (m) => {
    if (isPaper) {
      return m.price_mode === "total" ? (m.price_input ?? m.harga_per_rim) : m.harga_per_rim;
    }
    return isInk ? m.harga_per_kg : m.harga_per_satuan;
  };

  // Cache react-query: pindah menu terasa instan (data cache tampil lebih dulu),
  // lalu di-refresh otomatis di background (refetchOnMount: "always").
  const queryParams = useMemo(() => {
    const params = { year: new Date().getFullYear() };
    if (period.start) params.start = period.start;
    if (period.end) params.end = period.end;
    if (fJenis !== "all") params.jenis = fJenis;
    if (fTrx !== "all") params.transaksi = fTrx;
    if (fSupplier) params.supplier = fSupplier;
    if (search) params.search = search;
    return params;
  }, [period, fJenis, fTrx, fSupplier, search]);

  const queryClient = useQueryClient();
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["mutations", type, queryParams],
    queryFn: async () => (await api.get(`${base}/mutations`, { params: queryParams })).data,
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
  const { data: jenisOptions = [] } = useQuery({
    queryKey: ["jenis", type],
    queryFn: async () => (await api.get(`${base}/jenis`)).data,
    refetchOnMount: "always",
  });
  useEffect(() => { if (error) toast.error(apiError(error)); }, [error]);

  // Dipanggil setelah tambah/edit/hapus mutasi — invalidasi cache agar refetch.
  const load = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mutations", type] });
    queryClient.invalidateQueries({ queryKey: ["jenis", type] });
  }, [queryClient, type]);

  const keluarOptions = useMemo(() => rows.filter((r) => r.jenis_transaksi === "keluar"), [rows]);
  const masukOptions = useMemo(() => rows.filter((r) => r.jenis_transaksi === "masuk"), [rows]);
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);

  const canModify = (m) => {
    if (user?.role === "superadmin") return true;
    return m.created_by === user?.id && (m.created_at || "").slice(0, 10) === todayStr();
  };

  const openAdd = () => { setEditData(null); setFormOpen(true); };
  const openEdit = (m) => { setEditData(m); setFormOpen(true); };

  const doDelete = async () => {
    try {
      await api.delete(`${base}/mutations/${delId}`);
      toast.success("Mutasi dihapus.");
      setDelId(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const doDownload = async () => {
    try {
      const params = {};
      if (period.start) params.start = period.start;
      if (period.end) params.end = period.end;
      if (fJenis !== "all") params.jenis = fJenis;
      if (fTrx !== "all") params.transaksi = fTrx;
      if (fSupplier) params.supplier = fSupplier;
      await downloadPdf(`/pdf/${type}-mutations`, params, `laporan-mutasi-${type}.pdf`);
      toast.success("PDF diunduh.");
    } catch (e) { toast.error(apiError(e, "Gagal mengunduh PDF")); }
  };

  useEffect(() => { setPage(1); }, [search, fJenis, fTrx, fSupplier, period, pageSize]);

  const refLabel = (id) => {
    const r = rowById[id];
    return r?.kode ? r.kode : "#" + (id || "").slice(0, 6);
  };

  // Kolom yang bisa disembunyikan (pola data-table-view-options dashboard starter).
  const columnDefs = [
    { id: "date", label: "Tanggal" },
    { id: "kode", label: "Kode" },
    { id: "nama", label: isPaper ? "Jenis Kertas" : isOther ? "Nama Barang" : "Jenis Tinta" },
    ...(isPaper ? [{ id: "gram", label: "Gram" }, { id: "ukuran", label: "Ukuran" }] : []),
    ...(isOther ? [{ id: "satuan", label: "Satuan" }] : []),
    { id: "trx", label: "Transaksi" },
    { id: "jumlah", label: "Jumlah" },
    { id: "supplier", label: "Supplier" },
    { id: "pic", label: "PIC" },
    { id: "harga", label: "Harga" },
    { id: "ppn", label: "PPN" },
    { id: "aksi", label: "Aksi" },
  ];
  const visible = Object.fromEntries(columnDefs.map((c) => [c.id, hidden[c.id] !== true]));
  const show = (id) => visible[id] !== false;
  const toggleCol = (id, next) => setHidden((h) => ({ ...h, [id]: !next }));
  const colCount = columnDefs.filter((c) => show(c.id)).length;

  // Pagination sisi klien.
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <PageContainer
      fillHeight
      testid={`mutations-page-${type}`}
      pageTitle={`Mutasi ${TITLES[type]}`}
      pageDescription="Input & riwayat transaksi Masuk / Keluar / Retur."
      pageHeaderAction={(
        <>
          <TableViewOptions columns={columnDefs} visible={visible} onToggle={toggleCol} />
          <Button variant="outline" className="gap-2" data-testid="download-pdf-button" onClick={doDownload}><FileDown className="h-4 w-4" /> PDF</Button>
          <Button className="gap-2" data-testid="add-mutation-button" onClick={openAdd}><Plus className="h-4 w-4" /> Tambah Mutasi</Button>
        </>
      )}
    >

      <Card className="p-4 md:shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter onChange={setPeriod} />
          <div className="space-y-1.5">
            <Label className="text-xs">{isPaper ? "Jenis Kertas" : isOther ? "Nama Barang" : "Jenis Tinta"}</Label>
            <Select value={fJenis} onValueChange={setFJenis}>
              <SelectTrigger className="w-[160px]" data-testid="filter-jenis"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {jenisOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Transaksi</Label>
            <Select value={fTrx} onValueChange={setFTrx}>
              <SelectTrigger className="w-[140px]" data-testid="filter-transaksi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="masuk">Masuk</SelectItem>
                <SelectItem value="keluar">Keluar</SelectItem>
                <SelectItem value="retur">Retur/Sisa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Supplier</Label>
            <Input className="w-[150px]" value={fSupplier} data-testid="filter-supplier" placeholder="Supplier" onChange={(e) => setFSupplier(e.target.value)} />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label className="text-xs">Pencarian</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" value={search} data-testid="search-input" placeholder="Cari nama/kode/supplier/PIC…" onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Card tabel mengisi sisa tinggi viewport (flex-1 + min-h-0);
          area scroll internal = flex-1, pagination selalu menempel di dasar Card. */}
      <Card className="flex flex-col overflow-hidden md:min-h-0 md:flex-1">
        {isLoading ? (
          <TableSkeleton columns={colCount} rows={5} />
        ) : (
        <div className="max-h-[60vh] overflow-auto md:max-h-none md:min-h-0 md:flex-1">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {show("date") && <TableHead>Tanggal</TableHead>}
                {show("kode") && <TableHead>Kode</TableHead>}
                {show("nama") && <TableHead>{isPaper ? "Jenis Kertas" : isOther ? "Nama Barang" : "Jenis Tinta"}</TableHead>}
                {isPaper && show("gram") && <TableHead>Gram</TableHead>}
                {isPaper && show("ukuran") && <TableHead>Ukuran</TableHead>}
                {isOther && show("satuan") && <TableHead>Satuan</TableHead>}
                {show("trx") && <TableHead>Transaksi</TableHead>}
                {show("jumlah") && <TableHead className="text-right">Jumlah</TableHead>}
                {show("supplier") && <TableHead>Supplier</TableHead>}
                {show("pic") && <TableHead>PIC</TableHead>}
                {show("harga") && <TableHead className="text-right">Harga</TableHead>}
                {show("ppn") && <TableHead className="text-right">PPN</TableHead>}
                {show("aksi") && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody data-testid="mutations-table-body">
              {!isLoading && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount} className="py-6">
                    <Empty className="py-4">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                        <EmptyTitle>Belum ada data mutasi</EmptyTitle>
                        <EmptyDescription>Tambah mutasi baru atau ubah filter periode / pencarian.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
              {pagedRows.map((m) => (
                <TableRow key={m.id} className="stagger-in">
                  {show("date") && <TableCell className="whitespace-nowrap">{formatDateID(m.date)}</TableCell>}
                  {show("kode") && <TableCell className="code-chip text-xs">{m.kode || "-"}</TableCell>}
                  {show("nama") && (
                    <TableCell className="font-medium">
                      {nameOf(m)}
                      {m.ref_mutation_id && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
                          <Link2 className="h-3 w-3" /> Retur dari {refLabel(m.ref_mutation_id)}
                        </span>
                      )}
                    </TableCell>
                  )}
                  {isPaper && show("gram") && <TableCell>{formatNumber(m.gramatur)}</TableCell>}
                  {isPaper && show("ukuran") && <TableCell className="whitespace-nowrap">{formatNumber(m.panjang)}x{formatNumber(m.lebar)} cm</TableCell>}
                  {isOther && show("satuan") && <TableCell>{m.satuan || "-"}</TableCell>}
                  {show("trx") && <TableCell>{trxBadge(m.jenis_transaksi)}</TableCell>}
                  {show("jumlah") && <TableCell className="whitespace-nowrap text-right font-semibold">{formatNumber(m.jumlah)} {unitOf(m)}</TableCell>}
                  {show("supplier") && <TableCell>{m.supplier || "-"}</TableCell>}
                  {show("pic") && <TableCell>{m.pic_name}</TableCell>}
                  {show("harga") && (
                    <TableCell className="whitespace-nowrap text-right">
                      {m.jenis_transaksi === "masuk" ? formatRupiah(priceOf(m)) : "-"}
                      {isPaper && m.jenis_transaksi === "masuk" && m.price_mode && (
                        <div className="font-sans text-[10px] text-muted-foreground">{{ per_rim: "per rim", per_kg: "per kg", total: "total kiriman" }[m.price_mode]}</div>
                      )}
                    </TableCell>
                  )}
                  {show("ppn") && <TableCell className="whitespace-nowrap text-right">{m.ppn_ada ? formatRupiah(m.ppn_nominal) : "-"}</TableCell>}
                  {show("aksi") && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" disabled={!canModify(m)} data-testid={`edit-${m.id}`} onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={!canModify(m)} data-testid={`delete-${m.id}`} onClick={() => setDelId(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
        {total > 0 && (
          <TablePagination
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </Card>

      <MutationForm type={type} open={formOpen} onOpenChange={setFormOpen} onSaved={load}
        editData={editData} jenisOptions={jenisOptions} keluarOptions={keluarOptions} masukOptions={masukOptions} userName={user?.name} />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus mutasi ini?</AlertDialogTitle>
            <AlertDialogDescription>Stok akan dihitung ulang otomatis. Tindakan ini akan tercatat di log audit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-button" onClick={doDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
