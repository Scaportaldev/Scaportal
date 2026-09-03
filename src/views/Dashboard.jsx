import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { FileStack, Droplets, Activity, Wallet, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatRupiah, formatNumber, formatDateID, TRX_LABEL } from "@/lib/format";
import StatCard from "@/components/StatCard";
import PageContainer from "@/components/layout/PageContainer";
import ChartBox from "@/components/ChartBox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
} from "@/components/ui/chart";

const TREND_CONFIG = {
  paper_masuk: { label: "Kertas Masuk", color: "hsl(var(--chart-1))" },
  paper_keluar: { label: "Kertas Keluar", color: "hsl(var(--chart-2))" },
  ink_masuk: { label: "Tinta Masuk", color: "hsl(var(--chart-3))" },
  ink_keluar: { label: "Tinta Keluar", color: "hsl(var(--chart-4))" },
};

const trxBadge = (t) => {
  const map = { masuk: "bg-emerald-500/15 text-emerald-600", keluar: "bg-rose-500/15 text-rose-500", retur: "bg-amber-500/15 text-amber-600" };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[t]}`}>{TRX_LABEL[t]}</span>;
};

export default function Dashboard() {
  const { user } = useAuth();
  // Cache react-query: dashboard tampil instan dari cache, refresh di background.
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
    refetchOnMount: "always",
  });

  if (!data) return <PageContainer isLoading testid="stok-dashboard-loading" />;

  const isSuper = user?.role === "superadmin";

  return (
    <PageContainer
      testid="stok-dashboard-page"
      pageTitle="Dashboard"
      pageDescription={`Ringkasan stok & aktivitas mutasi tahun ${data.year}.`}
    >

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard testid="card-total-paper" icon={FileStack} accent="primary" label="Total Stok Kertas"
          value={`${formatNumber(data.total_paper_stock)} Rim`} />
        <StatCard testid="card-total-ink" icon={Droplets} accent="rose" label="Total Stok Tinta"
          value={`${formatNumber(data.total_ink_stock)} Kg`} />
        <StatCard testid="card-mutations-today" icon={Activity} accent="sky" label="Mutasi Hari Ini"
          value={`${data.mutations_today} transaksi`} sub="Kertas & tinta" />
        {isSuper ? (
          <StatCard testid="card-nominal-total" icon={Wallet} accent="emerald" label="Total Nominal Stok"
            value={formatRupiah(data.nominal_total)} sub={`Kertas ${formatRupiah(data.nominal_paper)} • Tinta ${formatRupiah(data.nominal_ink)} • Lain ${formatRupiah(data.nominal_other || 0)}`} />
        ) : (
          <StatCard testid="card-nominal-hidden" icon={Wallet} accent="emerald" label="Total Nominal Stok"
            value="Terkunci" sub="Buka via Laporan Detail" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-display text-lg font-bold">Tren Mutasi (6 Bulan Terakhir)</h3>
          <p className="mb-4 text-xs text-muted-foreground">Perbandingan jumlah Masuk vs Keluar.</p>
          <ChartBox className="h-64" data-testid="dashboard-trend-chart">
            <ChartContainer config={TREND_CONFIG}>
              <AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 4 }}>
                <defs>
                  {Object.keys(TREND_CONFIG).map((k) => (
                    <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 12 }} />
                <ChartTooltip
                  cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}
                  content={<ChartTooltipContent formatter={(v) => formatNumber(v)} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {Object.keys(TREND_CONFIG).map((k) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={TREND_CONFIG[k].label}
                    stroke={`var(--color-${k})`}
                    strokeWidth={2}
                    fill={`url(#fill-${k})`}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 2 }}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </ChartBox>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Mutasi Terbaru</h3>
          </div>
          <div className="space-y-2" data-testid="dashboard-recent-list">
            {data.recent.length === 0 && <p className="text-sm text-muted-foreground">Belum ada mutasi.</p>}
            {data.recent.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{m.kategori}</Badge>
                    <span className="truncate text-sm font-medium">{m.nama}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatDateID(m.date)} • {m.pic_name}</div>
                </div>
                <div className="text-right">
                  {trxBadge(m.jenis_transaksi)}
                  <div className="mt-0.5 text-xs font-semibold">{formatNumber(m.jumlah)} {m.satuan}</div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/kertas" className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Lihat semua mutasi <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    </PageContainer>
  );
}
