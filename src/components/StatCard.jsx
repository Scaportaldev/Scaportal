import { Card } from "@/components/ui/card";

/**
 * Struktur & posisi elemen dipertahankan persis (label di atas, nilai di
 * tengah, sub di bawah, ikon di kanan atas). Polish: ikon punya ring halus,
 * kartu terangkat sedikit saat hover (transform saja), dan nilai memakai
 * tabular-nums supaya digit lurus.
 */
export default function StatCard({ icon: Icon, label, value, sub, accent = "primary", testid }) {
  const accents = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    rose: "bg-rose-500/10 text-rose-500 ring-rose-500/15",
    sky: "bg-sky-500/10 text-sky-500 ring-sky-500/15",
    amber: "bg-amber-500/10 text-amber-600 ring-amber-500/15",
    emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
  };
  return (
    <Card
      className="stagger-in group p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift"
      data-testid={testid}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-2xl font-extrabold tracking-tight truncate [font-variant-numeric:tabular-nums]">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">{sub}</div>}
        </div>
        {Icon && (
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ring-1 transition-transform duration-200 ease-out group-hover:scale-105 ${accents[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
