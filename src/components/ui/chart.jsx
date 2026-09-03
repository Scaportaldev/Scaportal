"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

/**
 * Chart primitives ala shadcn/ui (di-port ke JavaScript) — pola dari 21st.dev.
 *
 * Menyediakan:
 *  - <ChartContainer config>  : wadah + injeksi CSS variable warna (--color-<key>)
 *  - <ChartTooltip>           : Recharts Tooltip
 *  - <ChartTooltipContent>    : tooltip bergaya card (glass + shadow)
 *  - <ChartLegend> / <ChartLegendContent>
 *
 * Catatan: ukuran chart tetap mengikuti container pemanggil (mis. ChartBox
 * dengan class h-64), jadi posisi & tinggi grafik di layar tidak berubah.
 */

const THEMES = { light: "", dark: ".dark" };

const ChartContext = React.createContext(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart harus dipakai di dalam <ChartContainer />");
  return context;
}

const ChartContainer = React.forwardRef(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          "flex h-full w-full justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 600, height: 256 }}
        >
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

const ChartStyle = ({ id, config }) => {
  const colorConfig = Object.entries(config || {}).filter(([, c]) => c && (c.theme || c.color));
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      formatter,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      labelClassName,
    },
    ref
  ) => {
    const { config } = useChart();

    if (!active || !payload?.length) return null;

    const resolvedLabel = labelFormatter ? labelFormatter(label, payload) : label;

    return (
      <div
        ref={ref}
        className={cn(
          "min-w-[9rem] rounded-lg border border-border/70 bg-popover/95 px-2.5 py-2 text-xs shadow-xl shadow-black/10",
          "supports-[backdrop-filter]:bg-popover/85 supports-[backdrop-filter]:backdrop-blur-md",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          className
        )}
      >
        {!hideLabel && resolvedLabel != null && (
          <div className={cn("mb-1.5 font-semibold text-foreground", labelClassName)}>
            {resolvedLabel}
          </div>
        )}
        <div className="grid gap-1">
          {payload.map((item, index) => {
            const key = item.dataKey || item.name || `item-${index}`;
            const itemConfig = config?.[key] || {};
            const color = item.color || itemConfig.color || `var(--color-${key})`;
            const value = formatter ? formatter(item.value, item.name, item) : item.value;

            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  {!hideIndicator && (
                    <span
                      className={cn(
                        "shrink-0 rounded-[2px]",
                        indicator === "line" ? "h-0.5 w-3" : "h-2 w-2 rounded-full"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <span className="truncate text-muted-foreground">
                    {itemConfig.label || item.name}
                  </span>
                </div>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef(({ payload, className, verticalAlign = "bottom" }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const key = item.dataKey || item.value;
        const itemConfig = config?.[key] || {};
        return (
          <div
            key={key}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-opacity duration-200 hover:opacity-100"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {itemConfig.label || item.value}
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

export {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
};
