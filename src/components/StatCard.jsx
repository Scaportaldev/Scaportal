import { useLayoutEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

/**
 * Nilai kartu statistik menyusut otomatis (auto-fit) supaya angka rupiah panjang
 * tidak terpotong "Rp 2.6..." di tablet (iPad / Android tablet) saat 4 kartu
 * sejajar. Ukuran dasar tetap text-2xl; hanya mengecil bila lebar tidak cukup
 * (minimal ~60% ukuran dasar), setelah itu baru fallback ke ellipsis.
 */
const MIN_SCALE = 0.6;

function FitValue({ children }) {
  const ref = useRef(null);
  const text = typeof children === "string" || typeof children === "number" ? String(children) : undefined;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const parent = el.parentElement;
    if (!parent) return;

    const fit = () => {
      el.style.fontSize = "";
      const base = parseFloat(window.getComputedStyle(el).fontSize) || 24;
      const avail = parent.clientWidth;
      const need = el.scrollWidth;
      if (avail > 0 && need > avail) {
        const scale = Math.max(MIN_SCALE, avail / need);
        el.style.fontSize = `${Math.floor(base * scale * 100) / 100}px`;
      }
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={ref}
      title={text}
      className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight truncate [font-variant-numeric:tabular-nums]"
      data-testid="stat-card-value"
    >
      {children}
    </div>
  );
}

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
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
          <FitValue>{value}</FitValue>
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
