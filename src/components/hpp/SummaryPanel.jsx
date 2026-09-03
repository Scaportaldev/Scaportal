import { formatRp } from "@/lib/format";

const RateRow = ({ label, pct, onPct, amount }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="w-20">
        <div className="relative">
          <input
            data-testid={`input-rate-${label.toLowerCase()}`}
            inputMode="decimal"
            value={pct ?? ""}
            onChange={(e) => onPct(e.target.value.replace(/[^\d.,]/g, ""))}
            className="h-9 w-full rounded-md border border-border bg-background pl-2.5 pr-6 text-right font-mono text-sm tabular-nums shadow-soft outline-none transition-[border-color,box-shadow] duration-200 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
        </div>
      </div>
    </div>
    <span className="font-mono text-sm">{formatRp(amount)}</span>
  </div>
);

export default function SummaryPanel({ res, rates, onRate, onSelect, enabled, onToggle }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-lift" data-testid="summary-panel">
      <div className="bg-gradient-to-br from-primary to-primary/80 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground/80">Total HPP — Harga Jual / Pcs</p>
        <p className="font-mono text-3xl font-semibold text-primary-foreground mt-1" data-testid="summary-final">{formatRp(res.final)}</p>
      </div>
      <div className="p-5">
        <div className="space-y-0.5">
          {res.components.map((c) => {
            const on = c.enabled !== false;
            return (
              <div key={c.key} className="flex items-center gap-2 py-1.5" data-testid={`summary-row-${c.key}`}>
                <input type="checkbox" checked={on} onChange={() => onToggle && onToggle(c.key)}
                  data-testid={`toggle-${c.key}`}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer" />
                <button onClick={() => onSelect && onSelect(c.key)}
                  className="flex-1 flex items-center justify-between gap-3 group text-left">
                  <span className={`text-sm transition-colors duration-200 ${on ? "text-muted-foreground group-hover:text-primary" : "text-muted-foreground/40 line-through"}`}>{c.label}</span>
                  <span className={`font-mono text-sm ${on ? "" : "text-muted-foreground/40"}`}>{formatRp(c.value)}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
          <span className="text-sm font-semibold">Subtotal HPP</span>
          <span className="font-mono text-base font-semibold" data-testid="summary-subtotal">{formatRp(res.subtotal)}</span>
        </div>
        <div className="mt-2">
          <RateRow label="Laba" pct={rates.labaPct} onPct={(v) => onRate("labaPct", v)} amount={res.laba} />
          <RateRow label="Bunga" pct={rates.bungaPct} onPct={(v) => onRate("bungaPct", v)} amount={res.bunga} />
          <RateRow label="PPN" pct={rates.ppnPct} onPct={(v) => onRate("ppnPct", v)} amount={res.ppn} />
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t-2 border-primary">
          <span className="text-sm font-semibold text-primary">HARGA JUAL / PCS</span>
          <span className="font-mono text-lg font-bold text-primary">{formatRp(res.final)}</span>
        </div>
      </div>
    </div>
  );
}
