import { useEffect, useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import api from "@/lib/api";
import { apiError } from "@/context/AuthContext";
import { formatRupiah, formatNumber, formatDateID, formatDateTimeID, TRX_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * AuditDiffDialog — modal perbandingan "Sebelum" vs "Sesudah" untuk satu log audit,
 * dalam format field-label yang manusiawi (bukan raw JSON).
 *
 * Props
 *   entry        : baris audit ringan dari daftar ({ id, action, mutation_type, name, timestamp, ... }).
 *                  Bila sudah memuat `before`/`after` dipakai langsung; kalau belum,
 *                  detail diambil dari GET /api/logs/audit/:id saat modal dibuka.
 *   onOpenChange : (open:boolean) => void
 */

export const ACTION_LABEL = { edit: "Edit", delete: "Hapus", create: "Tambah", add: "Tambah", update: "Edit" };
export const TYPE_LABEL = { paper: "Kertas", ink: "Tinta", other: "Lain" };

const FIELD_LABEL = {
  date: "Tanggal", year: "Tahun", kode: "Kode", jenis_transaksi: "Jenis Transaksi", jumlah: "Jumlah",
  supplier: "Supplier", pic_name: "PIC", ppn_ada: "Ada PPN", ppn_nominal: "Nominal PPN",
  ref_mutation_id: "Referensi Mutasi",
  jenis_kertas: "Jenis Kertas", gramatur: "Gramatur", panjang: "Panjang (cm)", lebar: "Lebar (cm)",
  price_mode: "Mode Harga", price_input: "Harga Input", harga_per_rim: "Harga per Rim",
  jenis_tinta: "Jenis Tinta", harga_per_kg: "Harga per Kg",
  nama_barang: "Nama Barang", satuan: "Satuan", harga_per_satuan: "Harga per Satuan",
  created_by_name: "Dibuat oleh", created_at: "Dibuat pada", updated_at: "Diperbarui pada",
  name: "Nama", username: "Username", role: "Peran", active: "Aktif", email: "Email", phone: "Telepon",
};
// Field teknis yang tidak berguna untuk pembaca manusia.
const HIDDEN_FIELDS = new Set(["id", "created_by", "_id", "password", "password_hash"]);
// Urutan tampil yang enak dibaca; sisanya menyusul sesuai urutan data.
const FIELD_ORDER = [
  "date", "kode", "jenis_kertas", "jenis_tinta", "nama_barang", "gramatur", "panjang", "lebar", "satuan",
  "jenis_transaksi", "jumlah", "supplier", "pic_name", "price_mode", "price_input", "harga_per_rim",
  "harga_per_kg", "harga_per_satuan", "ppn_ada", "ppn_nominal", "ref_mutation_id",
  "created_by_name", "created_at", "updated_at", "year",
];
const MONEY = new Set(["ppn_nominal", "price_input", "harga_per_rim", "harga_per_kg", "harga_per_satuan"]);
const PRICE_MODE = { per_rim: "Per Rim", per_kg: "Per Kg", total: "Total Kiriman" };

export function humanLabel(key) {
  if (FIELD_LABEL[key]) return FIELD_LABEL[key];
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanValue(key, v) {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (key === "jenis_transaksi") return TRX_LABEL[v] || String(v);
  if (key === "price_mode") return PRICE_MODE[v] || String(v);
  if (key === "date") return formatDateID(v);
  if (key === "created_at" || key === "updated_at") return formatDateTimeID(v);
  if (key === "ref_mutation_id") return "#" + String(v).slice(0, 8);
  if (key === "year") return String(v);
  if (MONEY.has(key)) return formatRupiah(v);
  if (typeof v === "number") return formatNumber(v, 3);
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length ? v.map((x) => humanValue("", x)).join(", ") : "-";
    return Object.entries(v).map(([k, x]) => `${humanLabel(k)}: ${humanValue(k, x)}`).join("; ") || "-";
  }
  return String(v);
}

const isEmptyObj = (o) => !o || typeof o !== "object" || Object.keys(o).length === 0;

/** Gabungkan & urutkan daftar field dari kedua sisi. */
export function buildFieldList(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const list = [...keys].filter((k) => !HIDDEN_FIELDS.has(k));
  const rank = (k) => { const i = FIELD_ORDER.indexOf(k); return i === -1 ? 999 : i; };
  list.sort((a, b) => rank(a) - rank(b));
  return list.map((k) => {
    const b = before?.[k], a = after?.[k];
    return { key: k, label: humanLabel(k), before: b, after: a, changed: JSON.stringify(b ?? null) !== JSON.stringify(a ?? null) };
  });
}

export function itemNameOf(before, after) {
  const src = !isEmptyObj(after) ? after : before;
  if (!src) return "";
  return src.jenis_kertas || src.jenis_tinta || src.nama_barang || src.name || src.username || src.kode || "";
}

function Panel({ title, tone, data, fields, side, hasBoth }) {
  const empty = isEmptyObj(data);
  return (
    <section className="min-w-0 rounded-xl border border-border/70 bg-background" data-testid={`audit-panel-${side}`}>
      <header className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className={cn("h-2 w-2 rounded-full", tone)} />
        <h4 className="text-sm font-semibold">{title}</h4>
      </header>
      {empty ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
          <Inbox className="h-5 w-5" />
          {side === "before" ? "Tidak ada data sebelumnya" : "Tidak ada data sesudah (data dihapus)"}
        </div>
      ) : (
        <dl className="divide-y divide-border/60">
          {fields.map((f) => {
            const v = data?.[f.key];
            const hl = hasBoth && f.changed;
            return (
              <div
                key={f.key}
                className={cn("grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-x-3 px-4 py-2", hl && "bg-amber-500/10 dark:bg-amber-400/10")}
                data-testid={`audit-field-${side}-${f.key}`}
              >
                <dt className="truncate text-xs text-muted-foreground">{f.label}</dt>
                <dd className={cn("min-w-0 break-words text-right text-sm tabular-nums", hl ? "font-semibold text-amber-700 dark:text-amber-300" : "font-medium text-foreground")}>
                  {humanValue(f.key, v)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}

export default function AuditDiffDialog({ entry, onOpenChange }) {
  const open = !!entry;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!entry) { setDetail(null); setError(""); return; }
    // Detail sudah ada di baris (format lama) -> pakai langsung.
    if (entry.before !== undefined || entry.after !== undefined) { setDetail(entry); return; }
    let alive = true;
    setLoading(true); setError("");
    api.get(`/logs/audit/${entry.id}`)
      .then((r) => { if (alive) setDetail(r.data); })
      .catch((e) => { if (alive) setError(apiError(e, "Gagal memuat detail audit")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [entry]);

  const before = detail?.before && typeof detail.before === "object" ? detail.before : null;
  const after = detail?.after && typeof detail.after === "object" ? detail.after : null;
  const fields = buildFieldList(before, after);
  const hasBoth = !isEmptyObj(before) && !isEmptyObj(after);
  const changedCount = hasBoth ? fields.filter((f) => f.changed).length : 0;
  const actionLabel = ACTION_LABEL[entry?.action] || (entry?.action ? entry.action[0].toUpperCase() + entry.action.slice(1) : "");
  const typeLabel = TYPE_LABEL[entry?.mutation_type] || entry?.mutation_type || "";
  const itemName = itemNameOf(before, after);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" data-testid="audit-diff-dialog">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/70 px-5 py-4 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-display text-lg leading-tight">
              {loading ? "Memuat perubahan…" : itemName || typeLabel || "Detail perubahan"}
            </DialogTitle>
            {entry?.action && (
              <Badge
                data-testid="audit-diff-action"
                className={cn("capitalize", entry.action === "delete"
                  ? "bg-rose-500/15 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
                  : "bg-sky-500/15 text-sky-700 hover:bg-sky-500/15 dark:text-sky-300")}
              >
                {actionLabel}
              </Badge>
            )}
            {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
          </div>
          <DialogDescription className="text-xs">
            {entry?.name ? `Oleh ${entry.name}` : ""}{entry?.timestamp ? ` · ${formatDateTimeID(entry.timestamp)}` : ""}
            {hasBoth && !loading ? ` · ${changedCount} field berubah` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2" data-testid="audit-diff-loading">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border/70 p-4">
                  <Skeleton className="h-4 w-1/3" />
                  {[...Array(6)].map((_, j) => <Skeleton key={j} className="h-3 w-full" />)}
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive" data-testid="audit-diff-error">{error}</p>
          ) : (
            <>
              {hasBoth && (
                <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block h-3 w-3 rounded-sm bg-amber-500/30" /> Baris yang disorot = nilai berubah
                </p>
              )}
              {/* 2 kolom side-by-side bila muat, ditumpuk di layar sempit */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
                <Panel title="Sebelum" tone="bg-rose-500" data={before} fields={fields} side="before" hasBoth={hasBoth} />
                <div className="hidden items-center justify-center pt-10 md:flex"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div>
                <Panel title="Sesudah" tone="bg-emerald-500" data={after} fields={fields} side="after" hasBoth={hasBoth} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
