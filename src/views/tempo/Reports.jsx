import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CheckCircle2, ChevronDown, Clock, Download, TrendingDown, Wallet,
} from "lucide-react";
import { toast } from "sonner";

import * as tapi from "@/lib/tempoApi";
import { apiError } from "@/context/AuthContext";
import { formatRp } from "@/lib/format";
import { compactRp } from "@/lib/tempoFormat";
import PageContainer from "@/components/layout/PageContainer";
import StatCard from "@/components/StatCard";
import ChartBox from "@/components/ChartBox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="mb-1 font-display text-sm font-bold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatRp(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function BreakdownPanel({ testid, title, tone, total, items, emptyText }) {
  const [open, setOpen] = useState(true);
  const list = items || [];
  const max = list.length ? list[0].amount : 0;
  const tones = {
    emerald: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    rose: { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
    primary: { bar: "bg-primary", text: "text-primary" },
  };
  const t = tones[tone] || tones.emerald;

  return (
    <Card className="rounded-2xl p-5" data-testid={testid}>
      <button type="button" className="flex w-full items-center justify-between gap-2"
        data-testid={`${testid}-toggle`} onClick={() => setOpen((o) => !o)}>
        <div className="text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{title}</div>
          <div className={`mt-1 font-display text-xl font-extrabold [font-variant-numeric:tabular-nums] ${t.text}`}>
            {formatRp(total)}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-3" data-testid={`${testid}-list`}>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            list.map((it) => (
              <div key={it.client} className="space-y-1" data-testid={`${testid}-item`}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{it.client}</span>
                  <span className={`shrink-0 font-semibold [font-variant-numeric:tabular-nums] ${t.text}`}>
                    {formatRp(it.amount)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${t.bar}`}
                    style={{ width: `${max > 0 ? Math.max(4, (it.amount / max) * 100) : 0}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

export default function TempoReports() {
  const year = new Date().getFullYear();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    const p = {};
    if (start) p.start = start;
    if (end) p.end = end;
    return p;
  }, [start, end]);

  const summaryQ = useQuery({
    queryKey: ["tempo", "summary", range],
    queryFn: () => tapi.getSummary(range),
    refetchOnMount: "always",
  });
  const breakdownQ = useQuery({
    queryKey: ["tempo", "breakdown", range],
    queryFn: () => tapi.getBreakdown(range),
    refetchOnMount: "always",
  });
  const monthlyQ = useQuery({
    queryKey: ["tempo", "monthly", year],
    queryFn: () => tapi.getMonthly(year),
    refetchOnMount: "always",
  });

  const summary = summaryQ.data;
  const breakdown = breakdownQ.data;
  const monthly = monthlyQ.data?.data || [];
  const loading = summaryQ.isLoading || breakdownQ.isLoading || monthlyQ.isLoading;

  const lunasPct = useMemo(() => {
    if (!summary || !summary.count_total) return 0;
    return Math.round((summary.count_lunas / summary.count_total) * 100);
  }, [summary]);

  const handleExport = async () => {
    if (!summary) return toast.error("Data laporan belum siap");
    setBusy(true);
    try {
      await tapi.exportTempoReportPdf({ ...range, year });
      toast.success("Laporan PDF diunduh");
    } catch (e) {
      toast.error(apiError(e, "Gagal export laporan"));
    } finally { setBusy(false); }
  };

  return (
    <PageContainer
      testid="tempo-reports-page"
      pageTitle="Laporan Jatuh Tempo"
      pageDescription="Ringkasan pemasukan, piutang, dan omset per bulan."
      pageHeaderAction={(
        <Button variant="outline" className="rounded-full gap-2" onClick={handleExport}
          disabled={busy} data-testid="reports-export-btn">
          <Download className="h-4 w-4" /> {busy ? "Menyiapkan..." : "Export PDF"}
        </Button>
      )}
    >
      <Card className="flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
          <Input type="date" data-testid="report-start-date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
          <Input type="date" data-testid="report-end-date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {(start || end) && (
          <Button variant="ghost" className="rounded-full" data-testid="report-clear-range"
            onClick={() => { setStart(""); setEnd(""); }}>Reset</Button>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard testid="stat-pemasukan" icon={Wallet} accent="emerald" label="Pemasukan Bulan Ini"
          value={loading ? "—" : formatRp(summary?.pemasukan_bulan_ini || 0)} />
        <StatCard testid="stat-piutang" icon={TrendingDown} accent="rose" label="Total Piutang"
          value={loading ? "—" : formatRp(summary?.total_piutang || 0)} />
        <StatCard testid="stat-lunas" icon={CheckCircle2} accent="primary" label="Invoice Lunas"
          value={loading ? "—" : `${summary?.count_lunas || 0} (${lunasPct}%)`} />
        <StatCard testid="stat-belum-lunas" icon={Clock} accent="amber" label="Belum Lunas"
          value={loading ? "—" : (summary?.count_belum_lunas || 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownPanel testid="breakdown-pemasukan" tone="emerald"
          title="Pemasukan Bulan Ini — per Klien"
          total={summary?.pemasukan_bulan_ini || 0}
          items={breakdown?.pemasukan_by_client}
          emptyText="Belum ada pembayaran masuk bulan ini." />
        <BreakdownPanel testid="breakdown-lunas" tone="primary"
          title="Lunas Bulan Ini — per Klien"
          total={(breakdown?.lunas_by_client || []).reduce((s, i) => s + i.amount, 0)}
          items={breakdown?.lunas_by_client}
          emptyText="Belum ada invoice yang lunas bulan ini." />
        <BreakdownPanel testid="breakdown-piutang" tone="rose"
          title="Total Piutang — per Klien"
          total={summary?.total_piutang || 0}
          items={breakdown?.piutang_by_client}
          emptyText="Tidak ada piutang berjalan. Semua lunas!" />
      </div>

      <Card className="rounded-2xl p-5" data-testid="omset-chart">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Omset per Bulan · {year}</h2>
        </div>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : (
          <ChartBox className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickLine={false} axisLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={compactRp} tickLine={false} axisLine={false} width={48}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="omset" name="Nilai Invoice" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="pembayaran" name="Pembayaran Diterima" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        )}
      </Card>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="rounded-2xl p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Total Nilai Invoice (terfilter)
            </div>
            <div className="mt-1 font-display text-xl font-extrabold [font-variant-numeric:tabular-nums]">
              {formatRp(summary.total_nilai_invoice)}
            </div>
          </Card>
          <Card className="rounded-2xl p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Total Terbayar (terfilter)
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-emerald-600 [font-variant-numeric:tabular-nums] dark:text-emerald-400">
              {formatRp(summary.total_terbayar)}
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
