import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Building2, FileDown, FileText, Package, Archive } from "lucide-react";
import { toast } from "sonner";

import * as kapi from "@/lib/klienApi";
import { apiError } from "@/context/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import StatCard from "@/components/StatCard";
import ClientCard from "@/components/klien/ClientCard";
import {
  KlienDialog, PODialog, ItemDialog, MutationDialog, ConfirmDeleteDialog,
} from "@/components/klien/KlienDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function KlienDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [expanded, setExpanded] = useState(() => new Set());
  const [dialog, setDialog] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["klien", "dashboard"],
    queryFn: kapi.klienDashboard,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (error) toast.error(apiError(error, "Gagal memuat data stok klien"));
  }, [error]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["klien"] });
  }, [queryClient]);

  const togglePo = (poId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });

  const toggleStatus = async (item) => {
    const next = item.status === "aktif" ? "selesai" : "aktif";
    try {
      await kapi.updateKlienItem(item.id, { status: next });
      toast.success(next === "aktif" ? "Item diaktifkan kembali" : "Item ditutup (Selesai)");
      refetch();
    } catch (err) {
      toast.error(apiError(err, "Gagal mengubah status"));
    }
  };

  const act = {
    editKlien: (klien) => setDialog({ type: "klien", klien }),
    deleteKlien: (klien) => setDialog({
      type: "delete",
      title: `Hapus klien "${klien.nama}"?`,
      description: "Seluruh PO, item, dan riwayat mutasi klien ini akan ikut terhapus permanen.",
      onConfirm: () => kapi.deleteKlien(klien.id),
    }),
    addPo: (klien) => setDialog({ type: "po", fixedKlien: klien }),
    editPo: (po) => setDialog({ type: "po", po }),
    deletePo: (po, klien) => setDialog({
      type: "delete",
      title: `Hapus PO No. ${po.no_po}?`,
      description: `Seluruh item dan riwayat mutasi pada PO milik ${klien.nama} ini akan ikut terhapus permanen.`,
      onConfirm: () => kapi.deleteKlienPo(po.id),
    }),
    addItem: (po, klien) => setDialog({ type: "item", po, klien }),
    editItem: (item, po, klien) => setDialog({ type: "item", item, po, klien }),
    deleteItem: (item, po) => setDialog({
      type: "delete",
      title: `Hapus item "${item.jenis_item}"?`,
      description: `Riwayat mutasi item ini pada PO No. ${po.no_po} juga akan terhapus permanen.`,
      onConfirm: () => kapi.deleteKlienItem(item.id),
    }),
    mutasi: (item, po, klien, jenis) => setDialog({ type: "mutasi", item, po, klien, jenis }),
    toggleStatus,
  };

  const filtered = useMemo(() => {
    if (!data?.kliens) return [];
    const q = search.trim().toLowerCase();
    return data.kliens
      .map((k) => {
        const klienMatch = !q || k.nama.toLowerCase().includes(q);
        const pos = (k.pos || [])
          .map((p) => ({
            ...p,
            items: (p.items || []).filter((it) => statusFilter === "semua" || it.status === statusFilter),
          }))
          .filter((p) => klienMatch || String(p.no_po).toLowerCase().includes(q));
        return { ...k, pos };
      })
      .filter((k) => (q ? k.nama.toLowerCase().includes(q) || k.pos.length > 0 : true));
  }, [data, search, statusFilter]);

  // Auto-buka PO yang cocok saat mencari supaya hasil langsung terlihat.
  useEffect(() => {
    if (search.trim() && data) {
      setExpanded(new Set(filtered.flatMap((k) => k.pos.map((p) => p.id))));
    }
  }, [search, data, filtered]);

  const doExport = async () => {
    setExporting(true);
    try {
      await kapi.exportKlienStokPdf(statusFilter);
      toast.success("Laporan PDF diunduh");
    } catch (err) {
      toast.error(apiError(err, "Gagal membuat laporan PDF"));
    } finally {
      setExporting(false);
    }
  };

  const s = data?.summary;
  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <PageContainer
      testid="klien-dashboard-page"
      pageTitle="Stok Klien"
      pageDescription="Pantau stok barang titipan tiap klien, per PO dan per item."
      pageHeaderAction={(
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-full gap-2" onClick={doExport}
            disabled={exporting} data-testid="klien-export-pdf">
            <FileDown className="h-4 w-4" /> {exporting ? "Menyiapkan..." : "Export PDF"}
          </Button>
          <Button variant="outline" className="rounded-full gap-2"
            onClick={() => setDialog({ type: "klien" })} data-testid="add-klien-btn">
            <Building2 className="h-4 w-4" /> Tambah Klien
          </Button>
          <Button className="rounded-full gap-2" onClick={() => setDialog({ type: "po" })} data-testid="add-po-global-btn">
            <Plus className="h-4 w-4" /> Tambah Klien / PO
          </Button>
        </div>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="klien-summary">
        <StatCard testid="stat-total_klien" icon={Building2} accent="primary"
          label="Total Klien" value={isLoading ? "—" : (s?.total_klien ?? 0)} />
        <StatCard testid="stat-total_po_aktif" icon={FileText} accent="sky"
          label="PO Aktif" value={isLoading ? "—" : (s?.total_po_aktif ?? 0)} />
        <StatCard testid="stat-total_item_aktif" icon={Package} accent="emerald"
          label="Item Aktif" value={isLoading ? "—" : (s?.total_item_aktif ?? 0)} />
        <StatCard testid="stat-total_item_selesai" icon={Archive} accent="amber"
          label="Item Selesai/Ditutup" value={isLoading ? "—" : (s?.total_item_selesai ?? 0)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-11 rounded-xl pl-10" placeholder="Cari nama klien atau No PO..."
            value={search} onChange={(e) => setSearch(e.target.value)} data-testid="klien-search-input" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-56" data-testid="klien-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua" data-testid="filter-status-semua">Semua Status</SelectItem>
            <SelectItem value="aktif" data-testid="filter-status-aktif">Aktif</SelectItem>
            <SelectItem value="selesai" data-testid="filter-status-selesai">Selesai/Ditutup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4" data-testid="klien-loading">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="ml-auto h-8 w-32 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : isEmpty ? (
        <Card className="rounded-2xl py-16" data-testid="klien-empty">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
              <EmptyTitle>
                {search || statusFilter !== "semua" ? "Tidak ada data yang cocok" : "Belum ada klien"}
              </EmptyTitle>
              <EmptyDescription>
                {search || statusFilter !== "semua"
                  ? "Coba ubah kata kunci atau filter status."
                  : "Mulai dengan menambahkan klien dan PO pertama Anda."}
              </EmptyDescription>
            </EmptyHeader>
            {!search && statusFilter === "semua" && (
              <EmptyContent>
                <Button className="mt-1 gap-2 rounded-full" onClick={() => setDialog({ type: "po" })}
                  data-testid="empty-add-po-btn">
                  <Plus className="h-4 w-4" /> Tambah Klien / PO
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="klien-list">
          {filtered.map((k, i) => (
            <div key={k.id} className="stagger-in" style={{ animationDelay: `${i * 40}ms` }}>
              <ClientCard klien={k} expanded={expanded} onTogglePo={togglePo} act={act} />
            </div>
          ))}
        </div>
      )}

      <KlienDialog open={dialog?.type === "klien"} onOpenChange={(o) => !o && setDialog(null)}
        klien={dialog?.klien} onSaved={refetch} />
      <PODialog open={dialog?.type === "po"} onOpenChange={(o) => !o && setDialog(null)}
        kliens={data?.kliens || []} fixedKlien={dialog?.fixedKlien} po={dialog?.po} onSaved={refetch} />
      <ItemDialog open={dialog?.type === "item"} onOpenChange={(o) => !o && setDialog(null)}
        po={dialog?.po} item={dialog?.item} onSaved={refetch} />
      <MutationDialog open={dialog?.type === "mutasi"} onOpenChange={(o) => !o && setDialog(null)}
        item={dialog?.item} po={dialog?.po} klien={dialog?.klien} jenis={dialog?.jenis} onSaved={refetch} />
      <ConfirmDeleteDialog open={dialog?.type === "delete"} onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.title} description={dialog?.description}
        onConfirm={dialog?.onConfirm || (() => Promise.resolve())} onDeleted={refetch} />
    </PageContainer>
  );
}
