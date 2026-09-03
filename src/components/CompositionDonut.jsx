import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Label as RLabel } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import ChartBox from "@/components/ChartBox";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * Donut komposisi nominal + legend sebagai DAFTAR TERPISAH di luar area SVG.
 *
 * Kenapa legend tidak memakai <ChartLegend> milik recharts:
 * recharts merender legend di dalam container chart yang tingginya tetap, dan
 * posisinya absolut. Begitu kategorinya banyak (11-16 item seperti komposisi
 * kertas/tinta), legend membungkus jadi banyak baris lalu MENUMPUK di atas
 * donut — terutama di layar HP. Dengan merender legend sebagai elemen HTML
 * biasa di bawah chart, tumpang tindih itu mustahil terjadi.
 *
 * Fitur:
 *  - urut dari nominal terbesar, lengkap dengan nominal & persentase
 *  - cross-highlight: arahkan kursor ke baris legend -> arc-nya menyala,
 *    yang lain meredup (dan sebaliknya)
 *  - daftar dipangkas ke 8 teratas dengan tombol "tampilkan semua"
 *  - angka di tengah donut dipendekkan (Rp 4,97 M) supaya tidak melebihi ring;
 *    nominal persisnya tetap tampil di header kartu
 */

// Palet 14 warna berbeda. Variabel --chart-1..5 saja tidak cukup: dengan 16
// kategori warnanya berulang sehingga legend jadi ambigu.
const PALETTE = [
  "hsl(221 83% 53%)", "hsl(347 77% 60%)", "hsl(199 89% 48%)", "hsl(38 92% 50%)",
  "hsl(160 84% 39%)", "hsl(271 76% 60%)", "hsl(15 86% 55%)", "hsl(190 80% 42%)",
  "hsl(96 60% 45%)", "hsl(320 70% 58%)", "hsl(48 90% 52%)", "hsl(240 70% 62%)",
  "hsl(0 72% 55%)", "hsl(174 70% 38%)",
];

const MAX_VISIBLE = 8;

/** Gabungkan entri bernama sama, buang nilai nol, urutkan dari terbesar. */
function normalize(list = []) {
  const map = new Map();
  for (const it of list) {
    const key = String(it?.name || "Lainnya");
    map.set(key, (map.get(key) || 0) + (Number(it?.value) || 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function CompositionDonut({ title, data, icon, emptyText, testId }) {
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => normalize(data), [data]);
  const total = useMemo(() => items.reduce((a, b) => a + b.value, 0), [items]);

  const chartData = useMemo(
    () => items.map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] })),
    [items]
  );

  const config = useMemo(
    () => Object.fromEntries(items.map((d, i) => [d.name, { label: d.name, color: PALETTE[i % PALETTE.length] }])),
    [items]
  );

  const shown = expanded ? chartData : chartData.slice(0, MAX_VISIBLE);
  const hidden = chartData.length - shown.length;

  return (
    <Card className="flex flex-col p-5" data-testid={testId}>
      {/* Header: judul + nominal total persis (tidak lagi dipaksa masuk ke tengah donut) */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
        {items.length > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {items.length} jenis
          </span>
        )}
      </div>
      {items.length > 0 && (
        <p className="mb-3 font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatRupiah(total)}
        </p>
      )}

      {items.length ? (
        <>
          {/* Donut — kotak persegi, ukuran dibatasi, tanpa legend di dalamnya */}
          <div className="mx-auto w-full max-w-[210px]">
            <ChartBox className="aspect-square w-full">
              <ChartContainer config={config} className="h-full w-full">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => (
                          <div className="flex w-full items-baseline justify-between gap-3">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-mono font-semibold tabular-nums">
                              {formatRupiah(value)}
                              <span className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">
                                ({total ? ((value / total) * 100).toFixed(1) : 0}%)
                              </span>
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="60%"
                    outerRadius="92%"
                    paddingAngle={1.5}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    onMouseEnter={(_, i) => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  >
                    {chartData.map((d, i) => (
                      <Cell
                        key={d.name}
                        fill={d.fill}
                        fillOpacity={active === null || active === i ? 1 : 0.22}
                        style={{ transition: "fill-opacity 150ms ease" }}
                      />
                    ))}
                    <RLabel
                      content={({ viewBox }) => {
                        if (!viewBox || !("cx" in viewBox)) return null;
                        const hovered = active !== null ? chartData[active] : null;
                        const value = hovered ? hovered.value : total;
                        const caption = hovered ? hovered.name : "Total";
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy - 10}
                              className="fill-muted-foreground text-[9px] uppercase tracking-[0.14em]"
                            >
                              {caption.length > 16 ? `${caption.slice(0, 15)}…` : caption}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy + 11}
                              className="fill-foreground font-mono text-base font-bold tabular-nums"
                            >
                              {formatRupiahCompact(value)}
                            </tspan>
                          </text>
                        );
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            </ChartBox>
          </div>

          {/* Legend: daftar HTML biasa di BAWAH donut -> tidak mungkin menumpuk */}
          <ul className="mt-4 space-y-0.5 border-t border-border pt-3" data-testid={testId ? `${testId}-legend` : undefined}>
            {shown.map((d, i) => {
              const pct = total ? (d.value / total) * 100 : 0;
              const isActive = active === i;
              return (
                <li
                  key={d.name}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    isActive ? "bg-muted" : "hover:bg-muted/60",
                    active !== null && !isActive && "opacity-45"
                  )}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: d.fill }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={d.name}>
                    {d.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-foreground">
                    {formatRupiahCompact(d.value)}
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {pct >= 0.1 ? pct.toFixed(1) : "<0,1"}%
                  </span>
                </li>
              );
            })}
          </ul>

          {chartData.length > MAX_VISIBLE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              data-testid={testId ? `${testId}-toggle` : undefined}
            >
              {expanded ? (
                <><ChevronUp className="size-3.5" /> Tampilkan lebih sedikit</>
              ) : (
                <><ChevronDown className="size-3.5" /> Tampilkan {hidden} jenis lainnya</>
              )}
            </button>
          )}
        </>
      ) : (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">{icon}</EmptyMedia>
            <EmptyTitle>Belum ada data nominal</EmptyTitle>
            <EmptyDescription>
              {emptyText || "Nominal muncul setelah ada mutasi masuk pada periode ini."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </Card>
  );
}
