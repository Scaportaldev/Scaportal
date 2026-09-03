import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/poApi";
import { useLang } from "@/context/LangContext";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STAGE_COLORS = {
  1: "#EAB308", 2: "#EAB308", 3: "#EAB308",
  4: "#3B82F6", 5: "#6366F1", 6: "#8B5CF6", 7: "#3B82F6", 8: "#06B6D4", 9: "#8B5CF6", 10: "#0EA5E9",
  11: "#10B981",
};

function ymd(d) { return d.toISOString().slice(0, 10); }
function monthName(d, lang) { return d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "long", year: "numeric" }); }

export default function PoCalendar() {
  const { t, stageName, lang } = useLang();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [schedules, setSchedules] = useState([]);
  const [pos, setPos] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [open, setOpen] = useState(false);
  const [formPo, setFormPo] = useState("");
  const [formStage, setFormStage] = useState("");
  const [formDate, setFormDate] = useState("");

  const load = async () => {
    try { const [s, p] = await Promise.all([api.listSchedules(), api.listPos()]); setSchedules(s); setPos(p); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  useEffect(() => { load(); }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const schedByDay = (ds) => schedules.filter((s) => s.date === ds);
  const blocksByDay = (ds) => pos.filter((p) => p.est_start && p.est_end && p.est_start <= ds && ds <= p.est_end && !p.computed?.is_completed);

  const weekdays = lang === "id" ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const openAdd = (ds) => { setFormDate(ds); setFormPo(""); setFormStage(""); setOpen(true); };

  const addSchedule = async () => {
    if (!formPo || !formStage || !formDate) { toast.error(t("selectPO")); return; }
    try { await api.createSchedule({ po_id: formPo, stage_number: parseInt(formStage), date: formDate }); setOpen(false); load(); toast.success("Jadwal ditambah"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const delSchedule = async (sid) => {
    try { await api.deleteSchedule(sid); load(); toast.success("Dihapus"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const selectedPoObj = pos.find((p) => p.id === formPo);

  return (
    <PageContainer
      testid="po-calendar-page"
      pageTitle={t("schedule")}
      pageDescription="Jadwal produksi & pengiriman per bulan."
      pageHeaderAction={(
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setCursor(new Date(year, month - 1, 1))} data-testid="cal-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-display font-bold w-40 text-center capitalize">{monthName(cursor, lang)}</div>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setCursor(new Date(year, month + 1, 1))} data-testid="cal-next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    >

      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="font-semibold">{t("legend")}:</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500" /> Tahap 1-3</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500" /> Produksi 4-10</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Kirim (11)</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary/20 border border-primary" /> {t("productionBlock")}</span>
      </div>

      <Card className="rounded-2xl p-3 sm:p-5 overflow-hidden">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekdays.map((w) => <div key={w} className="text-center text-xs font-semibold text-muted-foreground py-2">{w}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const ds = ymd(date);
            const scheds = schedByDay(ds);
            const blocks = blocksByDay(ds);
            const isToday = ds === ymd(new Date());
            return (
              <button key={i} data-testid={`cal-day-${ds}`} onClick={() => setSelectedDay(ds)}
                className={`relative min-h-[64px] sm:min-h-[92px] rounded-lg border p-1.5 text-left transition-colors ${isToday ? "border-primary" : "border-border/60"} ${selectedDay === ds ? "bg-accent" : "hover:bg-accent/40"} ${blocks.length ? "bg-primary/[0.06]" : ""}`}>
                <div className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{date.getDate()}</div>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {scheds.slice(0, 4).map((s) => (<span key={s.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage_number] || "#64748b" }} />))}
                </div>
                {blocks.length > 0 && (<div className="hidden sm:block absolute bottom-1 left-1 right-1 text-[9px] text-primary font-medium truncate">{blocks.length} produksi</div>)}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card className="rounded-2xl p-5 space-y-4" data-testid="day-detail">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5" /> {fmtDate(selectedDay)}</h2>
            <Button size="sm" className="rounded-full gap-1" onClick={() => openAdd(selectedDay)} data-testid="add-schedule-day"><Plus className="h-4 w-4" /> {t("scheduleStage")}</Button>
          </div>

          {blocksByDay(selectedDay).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">{t("productionBlock")}</div>
              <div className="flex flex-wrap gap-2">
                {blocksByDay(selectedDay).map((p) => (<span key={p.id} className="rounded-full bg-primary/10 text-primary border border-primary/30 px-3 py-1 text-xs font-medium">{p.po_number} · {p.client_name}</span>))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">{t("scheduledOn")}</div>
            {schedByDay(selectedDay).length === 0 ? (<p className="text-sm text-muted-foreground">{t("noScheduleThisDay")}</p>) : (
              <div className="space-y-2">
                {schedByDay(selectedDay).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage_number] }} />
                      <b>{s.po_number}</b> · {s.client_name} · <span className="text-muted-foreground">Tahap {s.stage_number}: {stageName(s.stage_number)}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 text-destructive" onClick={() => delSchedule(s.id)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("scheduleStage")} — {formDate}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("selectPO")}</Label>
              <Select value={formPo} onValueChange={setFormPo}>
                <SelectTrigger data-testid="sched-po"><SelectValue placeholder={t("selectPO")} /></SelectTrigger>
                <SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} · {p.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("selectStage")}</Label>
              <Select value={formStage} onValueChange={setFormStage} disabled={!formPo}>
                <SelectTrigger data-testid="sched-stage"><SelectValue placeholder={t("selectStage")} /></SelectTrigger>
                <SelectContent>{(selectedPoObj?.enabled_stages || []).map((n) => <SelectItem key={n} value={String(n)}>Tahap {n}: {stageName(n)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button className="rounded-full" onClick={addSchedule} data-testid="sched-submit">{t("addSchedule")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
