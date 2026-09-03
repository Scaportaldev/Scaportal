import { useCallback, useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Label as RLabel,
} from "recharts";
import { FileDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import api, { downloadPdf } from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import { formatRupiah, formatDateID } from "@/lib/format";
import SectionGate from "@/components/SectionGate";
import PeriodFilter from "@/components/PeriodFilter";
import StatCard from "@/components/StatCard";
import ChartBox from "@/components/ChartBox";
import PageContainer from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, FileStack, Droplets, Package } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
} from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

/** Gabungkan entri dengan nama sama supaya legend & key chart tetap unik. */
function mergeByName(list = []) {
  const map = new Map();
  list.forEach((it) => {
    const key = it.name || "Lainnya";
    map.set(key, (map.get(key) || 0) + (it.value || 0));
  });
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

const TREND_CONFIG = {
  paper_masuk: { label: "Kertas Masuk", color: "hsl(var(--chart-1))" },
  paper_keluar: { label: "Kertas Keluar", color: "hsl(var(--chart-2))" },
  ink_masuk: { label: "Tinta Masuk", color: "hsl(var(--chart-3))" },
  ink_keluar: { label: "Tinta Keluar", color: "hsl(var(--chart-4))" },
};

const VALUE_CONFIG = {
  paper: { label: "Kertas", color: "hsl(var(--chart-1))" },
  ink: { label: "Tinta", color: "hsl(var(--chart-2))" },
  other: { label: "Lain", color: "hsl(var(--chart-4))" },
};

const PPN_CONFIG = {
  paper: { label: "Kertas", color: "hsl(var(--chart-1))" },
  ink: { label: "Tinta", color: "hsl(var(--chart-4))" },
  other: { label: "Lain", color: "hsl(var(--chart-5))" },
};

function DiffBadge({ diff, pct }) {
  const up = diff > 0, down = diff < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const color = up ? "text-emerald-600" : down ? "text-rose-500" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3.5 w-3.5" /> {formatRupiah(Math.abs(diff))} ({pct}%)
    </span>
  );
}

function Inner() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";
  const [period, setPeriod] = useState({ start: "", end: "", label: "" });
  const [data, setData] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfPwd, setPdfPwd] = useState("");
  const [pdfKind, setPdfKind] = useState("detail");

  const load = useCallback(() => {
    if (!period.start) return;
    api.get("/reports/detail", { params: { start: period.start, end: period.end } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(apiError(e)));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  /** Unduh PDF tanpa cek password (dipakai setelah verifikasi / untuk superadmin). */
  const runDownload = async (kind) => {
    try {
      const params = { start: period.start, end: period.end };
      if (kind === "detail") await downloadPdf("/pdf/detail", params, "laporan-detail.pdf");
      else await downloadPdf("/pdf/stock-nominal", params, "laporan-stok-keseluruhan.pdf");
      toast.success("PDF diunduh.");
      setPdfOpen(false); setPdfPwd("");
      return true;
    } catch (e) { toast.error(apiError(e, "Gagal unduh PDF")); return false; }
  };

  const confirmDownload = async () => {
    try {
      await api.post("/auth/verify-temp-password", { password: pdfPwd });
    } catch (e) {
      toast.error(apiError(e, "Password salah")); return;
    }
    await runDownload(pdfKind);
  };

  // Superadmin punya akses penuh: langsung unduh tanpa dialog password.
  // Admin/PIC tetap wajib memasukkan password akses sementara.
  const openPdf = (kind) => {
    setPdfKind(kind);
    if (isSuper) { runDownload(kind); return; }
    setPdfPwd(""); setPdfOpen(true);
  };

  const cmp = data?.comparison;

  return (
    <PageContainer
      testid="detail-report-page"
      pageTitle="Laporan Detail"
      pageDescription={`Nominal, grafik, perbandingan periode & PPN. ${period.label}`}
      pageHeaderAction={(
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" data-testid="pdf-stock-nominal-button" onClick={() => openPdf("nominal")}>
            <FileDown className="h-4 w-4" /> Stok Keseluruhan
          </Button>
          <Button className="gap-2" data-testid="pdf-detail-button" onClick={() => openPdf("detail")}>
            <FileDown className="h-4 w-4" /> PDF Detail
          </Button>
        </div>
      )}
    >

      <Card className="p-4"><PeriodFilter onChange={setPeriod} /></Card>

      {!data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard testid="detail-nominal-paper" icon={FileStack} accent="primary" label="Nominal Stok Kertas" value={formatRupiah(data.nominal_paper)} />
            <StatCard testid="detail-nominal-ink" icon={Droplets} accent="rose" label="Nominal Stok Tinta" value={formatRupiah(data.nominal_ink)} />
            <StatCard testid="detail-nominal-other" icon={Package} accent="amber" label="Nominal Stok Lain" value={formatRupiah(data.nominal_other || 0)} />
            <StatCard testid="detail-nominal-total" icon={Wallet} accent="emerald" label="Total Nominal Stok" value={formatRupiah(data.nominal_total)} />
          </div>

          {/* Comparison */}
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold">Perbandingan Periode Sebelumnya</h3>
            <p className="mb-4 text-xs text-muted-foreground">Dibandingkan {formatDateID(cmp.prev_start)} s.d. {formatDateID(cmp.prev_end)}.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="comparison-grid">
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Nominal Kertas</div>
                <div className="font-display text-xl font-bold">{formatRupiah(cmp.paper_nominal.current)}</div>
                <DiffBadge diff={cmp.paper_nominal.diff} pct={cmp.paper_nominal.pct} />
              </div>
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Nominal Tinta</div>
                <div className="font-display text-xl font-bold">{formatRupiah(cmp.ink_nominal.current)}</div>
                <DiffBadge diff={cmp.ink_nominal.diff} pct={cmp.ink_nominal.pct} />
              </div>
              {cmp.other_nominal && (
                <div className="rounded-md border border-border p-4">
                  <div className="text-xs text-muted-foreground">Nominal Lain</div>
                  <div className="font-display text-xl font-bold">{formatRupiah(cmp.other_nominal.current)}</div>
                  <DiffBadge diff={cmp.other_nominal.diff} pct={cmp.other_nominal.pct} />
                </div>
              )}
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Mutasi Kertas (M/K)</div>
                <div className="font-display text-xl font-bold">{cmp.paper_masuk.current} / {cmp.paper_keluar.current}</div>
                <div className="text-xs text-muted-foreground">Lalu: {cmp.paper_masuk.prev} / {cmp.paper_keluar.prev}</div>
              </div>
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Mutasi Tinta (M/K)</div>
                <div className="font-display text-xl font-bold">{cmp.ink_masuk.current} / {cmp.ink_keluar.current}</div>
                <div className="text-xs text-muted-foreground">Lalu: {cmp.ink_masuk.prev} / {cmp.ink_keluar.prev}</div>
              </div>
            </div>
          </Card>

          {/* Composition pies */}
          <div className="grid gap-4 lg:grid-cols-3">
            {[["Komposisi Nominal Kertas", data.paper_composition], ["Komposisi Nominal Tinta", data.ink_composition], ["Komposisi Nominal Lain", data.other_composition || []]].map(([title, rawComp]) => {
              const comp = mergeByName(rawComp);
              return (
              <Card key={title} className="p-5">
                <h3 className="mb-2 font-display text-lg font-bold">{title}</h3>
                <ChartBox className="h-64">
                  {comp.length ? (
                    <ChartContainer
                      config={Object.fromEntries(comp.map((c, i) => [c.name, { label: c.name, color: COLORS[i % COLORS.length] }]))}
                    >
                      <PieChart>
                        <ChartTooltip
                          content={<ChartTooltipContent hideLabel formatter={(v) => formatRupiah(v)} />}
                        />
                        <Pie
                          data={comp}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={54}
                          outerRadius={84}
                          paddingAngle={2}
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                        >
                          {comp.map((c, i) => <Cell key={c.name} fill={COLORS[i % COLORS.length]} />)}
                          <RLabel
                            content={({ viewBox }) => {
                              if (!viewBox || !("cx" in viewBox)) return null;
                              const total = comp.reduce((a, b) => a + (b.value || 0), 0);
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy - 8} className="fill-muted-foreground text-[10px] uppercase tracking-[0.15em]">Total</tspan>
                                  <tspan x={viewBox.cx} y={viewBox.cy + 12} className="fill-foreground font-mono text-sm font-bold">{formatRupiah(total)}</tspan>
                                </text>
                              );
                            }}
                          />
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <Empty className="h-full py-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Wallet /></EmptyMedia>
                        <EmptyTitle>Belum ada data nominal</EmptyTitle>
                        <EmptyDescription>Nominal muncul setelah ada mutasi masuk pada periode ini.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </ChartBox>
              </Card>
              );
            })}
          </div>

          {/* Monthly trend + value */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-4 font-display text-lg font-bold">Tren Mutasi per Bulan</h3>
              <ChartBox className="h-64">
                <ChartContainer config={TREND_CONFIG}>
                  <AreaChart data={data.monthly_trend} margin={{ left: -20, right: 8, top: 4 }}>
                    <defs>
                      {Object.keys(TREND_CONFIG).map((k) => (
                        <linearGradient key={k} id={`dfill-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.32} />
                          <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 12 }} />
                    <ChartTooltip
                      cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}
                      content={<ChartTooltipContent />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {Object.keys(TREND_CONFIG).map((k) => (
                      <Area key={k} type="monotone" dataKey={k} name={TREND_CONFIG[k].label}
                        stroke={`var(--color-${k})`} strokeWidth={2} fill={`url(#dfill-${k})`}
                        dot={false} activeDot={{ r: 3.5, strokeWidth: 2 }} />
                    ))}
                  </AreaChart>
                </ChartContainer>
              </ChartBox>
            </Card>
            <Card className="p-5">
              <h3 className="mb-4 font-display text-lg font-bold">Nilai Total Stok per Bulan (Rp)</h3>
              <ChartBox className="h-64">
                <ChartContainer config={VALUE_CONFIG}>
                  <BarChart data={data.monthly_value} margin={{ left: 0, right: 8, top: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 1e6).toFixed(0) + "jt"} />
                    <ChartTooltip
                      cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.45 }}
                      content={<ChartTooltipContent formatter={(v) => formatRupiah(v)} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="paper" name="Kertas" stackId="a" fill="var(--color-paper)" />
                    <Bar dataKey="ink" name="Tinta" stackId="a" fill="var(--color-ink)" />
                    <Bar dataKey="other" name="Lain" stackId="a" fill="var(--color-other)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartBox>
            </Card>
          </div>

          {/* PPN */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Laporan PPN Dibayarkan per Bulan</h3>
              <span className="text-sm font-semibold">Total Tahun: {formatRupiah(data.ppn_total_year)}</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Bulan</TableHead><TableHead className="text-right">Kertas</TableHead>
                      <TableHead className="text-right">Tinta</TableHead><TableHead className="text-right">Lain</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody data-testid="ppn-table">
                    {data.ppn_monthly.map((p) => (
                      <TableRow key={p.label}>
                        <TableCell>{p.label}</TableCell>
                        <TableCell className="text-right">{formatRupiah(p.paper)}</TableCell>
                        <TableCell className="text-right">{formatRupiah(p.ink)}</TableCell>
                        <TableCell className="text-right">{formatRupiah(p.other || 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatRupiah(p.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ChartBox className="h-72">
                <ChartContainer config={PPN_CONFIG}>
                  <BarChart data={data.ppn_monthly.map((p) => ({ ...p, label: p.label.slice(0, 3) }))} margin={{ left: 0, right: 8, top: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 1e6).toFixed(0) + "jt"} />
                    <ChartTooltip
                      cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.45 }}
                      content={<ChartTooltipContent formatter={(v) => formatRupiah(v)} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="paper" name="Kertas" fill="var(--color-paper)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="ink" name="Tinta" fill="var(--color-ink)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="other" name="Lain" fill="var(--color-other)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartBox>
            </div>
          </Card>
        </>
      )}

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent data-testid="pdf-password-dialog">
          <DialogHeader><DialogTitle>Konfirmasi Password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Masukkan password akses sementara untuk mengunduh laporan bernominal ini.</p>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={pdfPwd} data-testid="pdf-password-input" onChange={(e) => setPdfPwd(e.target.value)} autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmDownload()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Batal</Button>
            <Button data-testid="pdf-password-confirm" onClick={confirmDownload}>Unduh PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default function DetailReport() {
  return <SectionGate title="Laporan Detail (Nominal & Grafik)"><Inner /></SectionGate>;
}
