import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Plus, Search, FileDown, Link2, Inbox } from "lucide-react";
import { toast } from "sonner";
import api, { downloadPdf } from "@/lib/api";
import { invalidateStok } from "@/lib/queryInvalidation";
import { useAuth, apiError } from "@/context/AuthContext";
import { formatRupiah, formatNumber, formatDateID, todayStr, TRX_LABEL } from "@/lib/format";
import MutationForm from "@/components/MutationForm";
import PeriodFilter, { defaultPeriod } from "@/components/PeriodFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import MutasiTable from "@/components/MutasiTable";
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

// ---- Definisi query (dipakai useQuery di bawah DAN prefetch saat hover menu) ----
export const mutationsQuery = (type, filterParams, page, pageSize) => ({
  queryKey: ["mutations", type, filterParams, page, pageSize],
  queryFn: async () => (await api.get(`/${type}/mutations`, { params: { ...filterParams, page, page_size: pageSize } })).data,
});
export const refsQuery = (type, year, transaksi) => ({
  queryKey: ["refs", type, transaksi, year],
  queryFn: async () => (await api.get(`/${type}/refs`, { params: { year, transaksi } })).data,
});
export const jenisQuery = (type) => ({
  queryKey: ["jenis", type],
  queryFn: async () => (await api.get(`/${type}/jenis`)).data,
});
/** Prefetch keadaan awal halaman mutasi: periode default, tanpa filter, hal 1, 25/hal. */
export { defaultPeriod };
export const makeMutationsPrefetch = (type) => (qc) => {
  const year = new Date().getFullYear();
  const { start, end } = defaultPeriod();
  return Promise.all([
    qc.prefetchQuery(mutationsQuery(type, { year, start, end }, 1, 25)),
    qc.prefetchQuery(jenisQuery(type)),
    qc.prefetchQuery(refsQuery(type, year, "keluar")),
    qc.prefetchQuery(refsQuery(type, year, "masuk")),
  ]);
};

export default function MutationsPage({ type }) {
  const isPaper = type === "paper";
  const isInk = type === "ink";
  const isOther = type === "other";
  const { user, perms } = useAuth();
  // Sama dengan nilai yang di-emit PeriodFilter saat mount (mode "Tahun Berjalan Penuh"),
  // supaya query pertama sudah benar dan tidak ada request perantara yang terbuang.
  const [period, setPeriod] = useState(() => defaultPeriod());
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
  // Debounce input teks 300ms supaya tidak memanggil server tiap ketikan.
  const [debSearch, setDebSearch] = useState("");
  const [debSupplier, setDebSupplier] = useState("");
  useEffect(() => { const h = setTimeout(() => setDebSearch(search.trim()), 300); return () => clearTimeout(h); }, [search]);
  useEffect(() => { const h = setTimeout(() => setDebSupplier(fSupplier.trim()), 300); return () => clearTimeout(h); }, [fSupplier]);

  const base = `/${type}`;
  const year = new Date().getFullYear();
  const nameOf = (m) => isPaper ? m.jenis_kertas : isOther ? m.nama_barang : m.jenis_tinta;
  const unitOf = (m) => isPaper ? "Rim" : isInk ? "Kg" : (m.satuan || "");
  // Mode "Total Kiriman": tampilkan total harga kiriman apa adanya (bukan hasil bagi per rim).
  const priceOf = (m) => {
    if (isPaper) {
      return m.price_mode === "total" ? (m.price_input ?? m.harga_per_rim) : m.harga_per_rim;
    }
    return isInk ? m.harga_per_kg : m.harga_per_satuan;
  };

  // Cache react-query: pindah menu terasa instan (staleTime global 30 dtk); setelah
  // simpan/hapus, semua query yang bergantung pada stok di-invalidate (invalidateStok).
  const filterParams = useMemo(() => {
    const params = { year };
    if (period.start) params.start = period.start;
    if (period.end) params.end = period.end;
    if (fJenis !== "all") params.jenis = fJenis;
    if (fTrx !== "all") params.transaksi = fTrx;
    if (debSupplier) params.supplier = debSupplier;
    if (debSearch) params.search = debSearch;
    return params;
  }, [year, period, fJenis, fTrx, debSupplier, debSearch]);

  // Filter & pagination dijalankan di server: hanya 1 halaman baris yang dikirim.
  const queryClient = useQueryClient();
  const { data: pageData, isLoading, error } = useQuery({
    ...mutationsQuery(type, filterParams, page, pageSize),
    placeholderData: keepPreviousData,
  });
  const rows = pageData?.items ?? [];
  const total = pageData?.total ?? 0;

  // Opsi referensi untuk form (dropdown mutasi Keluar/Masuk) — endpoint ringan, tidak
  // tergantung halaman/filter yang sedang dilihat.
  const { data: keluarOptions = [] } = useQuery(refsQuery(type, year, "keluar"));
  const { data: masukOptions = [] } = useQuery(refsQuery(type, year, "masuk"));
  const { data: jenisOptions = [] } = useQuery(jenisQuery(type));
  useEffect(() => { if (error) toast.error(apiError(error)); }, [error]);

  // Dipanggil setelah tambah/edit/hapus mutasi — invalidasi cache agar refetch.
  // Dipanggil setelah tambah/edit/hapus: segarkan daftar ini + Dashboard, Laporan Stok,
  // dropdown jenis/referensi, dan Log Audit (semua bergantung pada tabel mutasi).
  const load = useCallback(() => { invalidateStok(queryClient); }, [queryClient]);

  // Peta id -> baris untuk label "Retur dari <kode>" (referensi bisa berada di halaman lain,
  // jadi gabungkan baris halaman ini + opsi referensi keluar/masuk).
  const rowById = useMemo(
    () => Object.fromEntries([...keluarOptions, ...masukOptions, ...rows].map((r) => [r.id, r])),
    [rows, keluarOptions, masukOptions],
  );

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

  useEffect(() => { setPage(1); }, [filterParams, pageSize]);

  const refLabel = (id) => {
    const r = rowById[id];
    return r?.kode ? r.kode : "#" + (id || "").slice(0, 6);
  };

  // Kolom yang bisa disembunyikan (pola data-table-view-options dashboard starter).
  const nameLabel = isPaper ? "Jenis Kertas" : isOther ? "Nama Barang" : "Jenis Tinta";
  const columnDefs = [
    { id: "date", label: "Tanggal" },
    { id: "kode", label: "Kode" },
    { id: "nama", label: nameLabel },
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

  // Konfigurasi kolom MutasiTable — dinamis per jenis mutasi (Kertas punya Gram/Ukuran,
  // Lain punya Satuan, dst). Kolom yang disembunyikan lewat TableViewOptions ikut hilang
  // baik di tabel desktop maupun kartu mobile.
  const priceModeLabel = { per_rim: "per rim", per_kg: "per kg", total: "total kiriman" };
  const tableColumns = [
    show("date") && { id: "date", label: "Tanggal", cellClassName: "whitespace-nowrap", render: (m) => formatDateID(m.date) },
    show("kode") && { id: "kode", label: "Kode", cellClassName: "code-chip text-xs", render: (m) => m.kode || "-" },
    show("nama") && {
      id: "nama", label: nameLabel, role: "name", cellClassName: "font-medium",
      render: (m) => (
        <>
          {nameOf(m)}
          {m.ref_mutation_id && (
            <span className="ml-1 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
              <Link2 className="h-3 w-3" /> Retur dari {refLabel(m.ref_mutation_id)}
            </span>
          )}
        </>
      ),
    },
    isPaper && show("gram") && { id: "gram", label: "Gram", render: (m) => formatNumber(m.gramatur) },
    isPaper && show("ukuran") && { id: "ukuran", label: "Ukuran", cellClassName: "whitespace-nowrap", render: (m) => `${formatNumber(m.panjang)}x${formatNumber(m.lebar)} cm` },
    isOther && show("satuan") && { id: "satuan", label: "Satuan", render: (m) => m.satuan || "-" },
    show("trx") && { id: "trx", label: "Transaksi", role: "status", render: (m) => trxBadge(m.jenis_transaksi) },
    show("jumlah") && { id: "jumlah", label: "Jumlah", align: "right", cellClassName: "whitespace-nowrap font-semibold", render: (m) => `${formatNumber(m.jumlah)} ${unitOf(m)}` },
    show("supplier") && { id: "supplier", label: "Supplier", render: (m) => m.supplier || "-" },
    show("pic") && { id: "pic", label: "PIC", render: (m) => m.pic_name },
    show("harga") && {
      id: "harga", label: "Harga", align: "right", cellClassName: "whitespace-nowrap",
      render: (m) => (
        <>
          {m.jenis_transaksi === "masuk" ? formatRupiah(priceOf(m)) : "-"}
          {isPaper && m.jenis_transaksi === "masuk" && m.price_mode && (
            <div className="font-sans text-[10px] font-normal text-muted-foreground">{priceModeLabel[m.price_mode]}</div>
          )}
        </>
      ),
    },
    show("ppn") && { id: "ppn", label: "PPN", align: "right", cellClassName: "whitespace-nowrap", render: (m) => (m.ppn_ada ? formatRupiah(m.ppn_nominal) : "-") },
  ].filter(Boolean);

  // Aksi Edit/Hapus. onDelete hanya membuka dialog konfirmasi (AlertDialog di bawah).
  const tableActions = show("aksi") ? {
    onEdit: openEdit,
    onDelete: (m) => setDelId(m.id),
    canModify,
    editTestId: (m) => `edit-${m.id}`,
    deleteTestId: (m) => `delete-${m.id}`,
  } : null;

  // Pagination sisi server; jaga agar halaman tidak melampaui total (mis. setelah hapus).
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pagedRows = rows;

  return (
    <PageContainer
      fillHeight
      testid={`mutations-page-${type}`}
      pageTitle={`Mutasi ${TITLES[type]}`}
      pageDescription="Input & riwayat transaksi Masuk / Keluar / Retur."
      pageHeaderAction={(
        <>
          <TableViewOptions columns={columnDefs} visible={visible} onToggle={toggleCol} />
          {perms.canStokPdf && (
            <Button variant="outline" className="gap-2" data-testid="download-pdf-button" onClick={doDownload}><FileDown className="h-4 w-4" /> PDF</Button>
          )}
          <Button className="gap-2" data-testid="add-mutation-button" onClick={openAdd}><Plus className="h-4 w-4" /> Tambah Mutasi</Button>
        </>
      )}
    >

      <Card className="p-4 md:shrink-0">
        {/* Di HP semua filter ditata satu grid 2 kolom supaya sejajar; dari sm
            ke atas kembali jadi satu baris seperti sebelumnya. */}
        <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap [&>*]:min-w-0">
          <PeriodFilter onChange={setPeriod} asFields />
          <div className="space-y-1.5">
            <Label className="text-xs">{isPaper ? "Jenis Kertas" : isOther ? "Nama Barang" : "Jenis Tinta"}</Label>
            <Select value={fJenis} onValueChange={setFJenis}>
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="filter-jenis"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {jenisOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Transaksi</Label>
            <Select value={fTrx} onValueChange={setFTrx}>
              <SelectTrigger className="w-full sm:w-[140px]" data-testid="filter-transaksi"><SelectValue /></SelectTrigger>
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
            <Input className="w-full sm:w-[150px]" value={fSupplier} data-testid="filter-supplier" placeholder="Supplier" onChange={(e) => setFSupplier(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1 sm:flex-1 sm:min-w-[180px]">
            <Label className="text-xs">Pencarian</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" value={search} data-testid="search-input" placeholder="Cari nama/kode/supplier/PIC…" onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Desktop: Card tabel mengisi sisa tinggi viewport (flex-1 + min-h-0), area scroll
          internal = flex-1, pagination menempel di dasar Card.
          Mobile: Card "transparan" agar kartu-kartu mutasi tampil langsung di atas
          background halaman; pagination dibungkus kartunya sendiri. */}
      <div
        className="flex flex-col gap-3 md:gap-0 md:min-h-0 md:flex-1 md:overflow-hidden md:rounded-xl md:border md:border-border/70 md:bg-card md:text-card-foreground md:shadow-soft"
        data-testid={`mutations-table-card-${type}`}
      >
        <MutasiTable
          columns={tableColumns}
          data={pagedRows}
          rowKey={(m) => m.id}
          actions={tableActions}
          isLoading={isLoading && !pageData}
          skeletonRows={5}
          scrollClassName="overflow-auto md:min-h-0 md:flex-1"
          testid="mutations-table-body"
          empty={{
            icon: <Inbox />,
            title: "Belum ada data mutasi",
            description: "Tambah mutasi baru atau ubah filter periode / pencarian.",
          }}
        />
        {total > 0 && (
          <TablePagination
            className="max-md:static max-md:rounded-xl max-md:border max-md:border-border/70 max-md:shadow-soft"
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

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
