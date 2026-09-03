import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, XCircle, Boxes } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { BUCKET_META } from "@/lib/poStages";
import * as api from "@/lib/poApi";
import { Card } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";

const ORDER = [
  "waiting_1", "waiting_2", "waiting_3",
  "stage_4", "stage_5", "stage_6", "stage_7", "stage_8", "stage_9", "stage_10",
  "printing", "print_done_not_shipped", "delivery_failed", "shipped",
];

export default function PoDashboard() {
  const { t } = useLang();
  const navigate = useNavigate();
  // Cache react-query: tampil instan dari cache, refresh otomatis di background.
  const { data } = useQuery({
    queryKey: ["po", "dashboard"],
    queryFn: () => api.poDashboard(),
    refetchOnMount: "always",
  });
  const counts = data?.counts || {};
  const goto = (bucket) => navigate(`/po/pos${bucket ? `?bucket=${bucket}` : ""}`);

  const topCards = [
    { label: t("totalPO"), value: data?.total ?? 0, icon: Boxes, color: "#1D4ED8", bucket: "" },
    { label: t("activePO"), value: data?.total_active ?? 0, icon: Activity, color: "#3B82F6", bucket: "active" },
    { label: t("completedPO"), value: data?.total_completed ?? 0, icon: CheckCircle2, color: "#10B981", bucket: "completed" },
    { label: t("b_failed"), value: counts.delivery_failed ?? 0, icon: XCircle, color: "#EF4444", bucket: "delivery_failed" },
  ];

  return (
    <PageContainer
      testid="po-dashboard-page"
      pageTitle={t("overview")}
      pageDescription={t("tapToFilter")}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((c, i) => (
          <Card key={c.label} data-testid={`po-summary-${c.bucket || "total"}`} onClick={() => goto(c.bucket)}
            style={{ animationDelay: `${i * 50}ms`, borderLeftColor: c.color }}
            className="cursor-pointer rounded-2xl p-5 border-l-4 hover:-translate-y-1 transition-transform duration-200 stagger-in">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-display font-extrabold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}1a`, color: c.color }}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-display text-xl font-bold mb-4">{t("stage")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ORDER.map((bucket, i) => {
            const meta = BUCKET_META[bucket] || (bucket === "shipped" ? { color: "#10B981", label: t("b_completed") } : null);
            const value = bucket === "shipped" ? (counts.shipped ?? 0) : (counts[bucket] ?? 0);
            const label = bucket === "shipped" ? t("b_completed") : (meta?.label || bucket);
            return (
              <Card key={bucket} data-testid={`po-stage-card-${bucket}`}
                onClick={() => goto(bucket === "shipped" ? "completed" : bucket)}
                style={{ animationDelay: `${i * 40}ms` }}
                className="cursor-pointer rounded-xl p-4 hover:-translate-y-1 transition-transform duration-200 stagger-in">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta?.color }} />
                  <span className="text-2xl font-display font-bold">{value}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-tight">{label}</div>
              </Card>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
