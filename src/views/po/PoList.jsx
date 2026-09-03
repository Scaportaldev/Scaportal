import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Eye, Pencil, Trash2, Package, FileDown } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/poApi";
import { useLang } from "@/context/LangContext";
import { BUCKET_META } from "@/lib/poStages";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FILTER_BUCKETS = [
  "active", "completed", "waiting_1", "waiting_2", "waiting_3",
  "stage_4", "stage_5", "stage_6", "stage_7", "stage_8", "stage_9", "stage_10",
  "print_done_not_shipped", "delivery_failed",
];

function BucketBadge({ bucket }) {
  const meta = BUCKET_META[bucket] || { color: "#94A3B8", label: "-" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: meta.color }}>{meta.label}</span>
  );
}

export default function PoList() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const bucket = params.get("bucket") || "";
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [delId, setDelId] = useState(null);
  const [month, setMonth] = useState("all");

  const monthLabel = (m) => new Date(m + "-01T00:00:00").toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "long", year: "numeric" });

  // Debounce pencarian 250ms (perilaku lama dipertahankan)
  useEffect(() => { const h = setTimeout(() => setDebSearch(search), 250); return () => clearTimeout(h); }, [search]);

  // Cache react-query: tampil instan dari cache, refresh otomatis di background.
  const queryClient = useQueryClient();
  const { data: allMonths = [] } = useQuery({
    queryKey: ["po", "months"],
    queryFn: async () => {
      const rows = await api.listPos();
      return [...new Set(rows.map((p) => (p.po_date || p.est_start || "").slice(0, 7)).filter((x) => x.length === 7))].sort().reverse();
    },
    refetchOnMount: "always",
  });

  const downloadPdf = async () => {
    try {
      const q = {};
      if (search) q.search = search;
      if (bucket) q.bucket = bucket;
      if (month !== "all") q.month = month;
      await api.exportPoRekapPdf(q);
      toast.success("PDF diunduh");
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal export"); }
  };

  const q = useMemo(() => {
    const query = {};
    if (debSearch) query.search = debSearch;
    if (bucket) query.bucket = bucket;
    if (month !== "all") query.month = month;
    return query;
  }, [debSearch, bucket, month]);

  const { data: pos = [], isLoading: loading, error } = useQuery({
    queryKey: ["po", "list", q],
    queryFn: () => api.listPos(q),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
  useEffect(() => { if (error) toast.error(error?.response?.data?.detail || "Gagal memuat"); }, [error]);

  const confirmDelete = async () => {
    try {
      await api.deletePo(delId);
      toast.success("PO dihapus");
      setDelId(null);
      queryClient.invalidateQueries({ queryKey: ["po"] });
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal hapus"); }
  };

  return (
    <PageContainer
      testid="po-list-page"
      pageTitle={t("poList")}
      pageDescription="Kelola PO, pantau progres produksi, dan jadwal pengiriman."
      pageHeaderAction={(
        <div className="flex items-center gap-2">
          <Button data-testid="po-export-pdf" onClick={downloadPdf} variant="outline" className="rounded-full gap-2">
            <FileDown className="h-4 w-4" /> {t("exportPdf")}
          </Button>
          <Button data-testid="po-new" onClick={() => navigate("/po/pos/new")} className="rounded-full gap-2">
            <Plus className="h-4 w-4" /> {t("newPO")}
          </Button>
        </div>
      )}
    >

      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="po-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-10 h-11 rounded-xl" />
        </div>
        <Select value={bucket || "all"} onValueChange={(v) => setParams(v === "all" ? {} : { bucket: v })}>
          <SelectTrigger data-testid="po-filter" className="w-full sm:w-56 h-11 rounded-xl"><SelectValue placeholder={t("filterAll")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            {FILTER_BUCKETS.map((b) => (
              <SelectItem key={b} value={b}>
                {b === "active" ? t("activePO") : b === "completed" ? t("completedPO") : (BUCKET_META[b]?.label || b)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger data-testid="po-month-filter" className="w-full sm:w-48 h-11 rounded-xl"><SelectValue placeholder={t("allMonths")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allMonths")}</SelectItem>
            {allMonths.map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="po-list-skeleton">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="space-y-2 pt-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
              <Skeleton className="mt-auto h-9 w-full rounded-md" />
            </Card>
          ))}
        </div>
      ) : pos.length === 0 ? (
        <Card className="rounded-2xl py-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Package /></EmptyMedia>
              <EmptyTitle>{t("noData")}</EmptyTitle>
              <EmptyDescription>Buat PO pertama untuk mulai melacak progres produksi & pengiriman.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => navigate("/po/pos/new")} className="mt-1 gap-2 rounded-full"><Plus className="h-4 w-4" /> {t("newPO")}</Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pos.map((po, i) => (
            <Card key={po.id} data-testid={`po-card-${po.po_number}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className="rounded-2xl p-5 flex flex-col gap-3 hover:-translate-y-1 transition-transform duration-200 stagger-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg truncate">{po.po_number}</div>
                  <div className="text-sm text-muted-foreground truncate">{po.client_name}</div>
                </div>
                <BucketBadge bucket={po.computed?.bucket} />
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                {po.item_type && <div className="truncate">📦 {po.item_type}</div>}
                {(po.est_start || po.est_end) && <div>🗓 {fmtDate(po.est_start)} → {fmtDate(po.est_end)}</div>}
                {po.print_machine && <div>🖨 {po.print_machine}</div>}
              </div>
              <div className="text-xs text-muted-foreground">{t("stage")}: <span className="font-semibold text-foreground">{po.computed?.current_stage_name}</span></div>
              <div className="flex gap-2 pt-1 mt-auto">
                <Button data-testid={`po-detail-${po.po_number}`} onClick={() => navigate(`/po/pos/${po.id}`)} size="sm" className="rounded-full gap-1 flex-1">
                  <Eye className="h-4 w-4" /> {t("detail")}
                </Button>
                <Button data-testid={`po-edit-${po.po_number}`} onClick={() => navigate(`/po/pos/${po.id}/edit`)} variant="outline" size="icon" className="rounded-full">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button data-testid={`po-delete-${po.po_number}`} onClick={() => setDelId(po.id)} variant="outline" size="icon" className="rounded-full text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("poNumber")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction data-testid="po-confirm-delete" onClick={confirmDelete} className="bg-destructive text-destructive-foreground">{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
