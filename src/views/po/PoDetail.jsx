import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, RotateCcw, Upload, X, Truck, History, Pencil, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/poApi";
import { API } from "@/lib/api";
import { useLang } from "@/context/LangContext";
import { FINISHING_OPTIONS, GLUE_OPTIONS, MACHINES } from "@/lib/poStages";
import { fmtDate, fmtDateTime } from "@/lib/format";
import ProductionStepper from "@/components/po/ProductionStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PoDetail() {
  const { id } = useParams();
  const { t, stageName } = useLang();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [active, setActive] = useState(null);

  const load = async () => {
    try {
      const data = await api.getPo(id);
      setPo(data);
      setActive((a) => a ?? (data.enabled_stages || [])[0]);
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal load"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!po) return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );

  const sd = po.stage_data || {};
  const data = sd[String(active)] || {};

  const updateStage = async (patch) => {
    try { const updated = await api.updateStage(id, active, patch); setPo(updated); toast.success("Tersimpan"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal simpan"); }
  };

  const done = (() => {
    if (active === 1) return data.needs_single_face ? (data.paper_arrived && data.single_face_arrived) : data.paper_arrived;
    if (active === 2 || active === 3) return data.arrived;
    if (active === 11) {
      const att = (data.delivery_attempts || []).slice(-1)[0];
      return data.print_completed && att && att.status === "success";
    }
    return data.done;
  })();

  return (
    <div className="space-y-6" data-testid="po-detail-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => navigate("/po/pos")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{po.po_number}</h1>
          <p className="text-muted-foreground">{po.client_name}</p>
        </div>
        <Button variant="outline" className="rounded-full gap-2" onClick={() => navigate(`/po/pos/${id}/edit`)}>
          <Pencil className="h-4 w-4" /> {t("edit")}
        </Button>
      </div>

      <Card className="rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
        <Info label={t("itemType")} value={po.item_type} />
        <Info label={t("material")} value={po.material} />
        <Info label={t("paperSize")} value={po.paper_size} />
        <Info label={t("quantity")} value={po.quantity} />
        <Info label={t("poDate")} value={fmtDate(po.po_date)} />
        <Info label={t("estStart")} value={fmtDate(po.est_start)} />
        <Info label={t("estEnd")} value={fmtDate(po.est_end)} />
        <Info label={t("printMachine")} value={po.print_machine} />
        <Info label={t("createdBy")} value={po.created_by} />
        {po.notes && <div className="col-span-2 sm:col-span-3 lg:col-span-4"><Info label={t("notes")} value={po.notes} /></div>}
      </Card>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <div>
          <h2 className="font-display font-bold mb-3">{t("progress")}</h2>
          <ProductionStepper po={po} activeStage={active} onSelect={setActive} />
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl p-6" data-testid={`stage-panel-${active}`}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground">Tahap {active}</div>
                <h3 className="font-display text-xl font-bold">{stageName(active)}</h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${done ? "bg-emerald-500" : "bg-blue-500"}`}>{done ? t("done") : t("pending")}</span>
            </div>
            <StageBody num={active} data={data} po={po} done={done} updateStage={updateStage} reload={load} t={t} />
            <StageKeterangan value={data.keterangan} onSave={(val) => updateStage({ keterangan: val })} t={t} />
          </Card>

          <PhotoSection po={po} num={active} reload={load} t={t} />
        </div>
      </div>

      <Card className="rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4"><History className="h-5 w-5 text-muted-foreground" /><h2 className="font-display font-bold">{t("history")}</h2></div>
        <div className="space-y-3 max-h-72 overflow-auto">
          {(po.logs || []).slice().reverse().map((log, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div><div>{log.message}</div><div className="text-xs text-muted-foreground">{fmtDateTime(log.timestamp)}</div></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value || "-"}</div></div>;
}

function StageKeterangan({ value, onSave, t }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return (
    <div className="mt-5 space-y-2 border-t border-border pt-4">
      <Label>{t("keterangan")}</Label>
      <Textarea data-testid="stage-keterangan" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== (value || "")) onSave(v); }}
        placeholder={t("keteranganPlaceholder")} className="rounded-xl min-h-[70px]" />
    </div>
  );
}

function MarkDoneBtn({ done, onToggle, t }) {
  return (
    <Button data-testid="mark-done-btn" onClick={onToggle} className="rounded-full gap-2" variant={done ? "outline" : "default"}>
      {done ? <><RotateCcw className="h-4 w-4" /> {t("reopen")}</> : <><Check className="h-4 w-4" /> {t("markDone")}</>}
    </Button>
  );
}

function StageBody({ num, data, po, done, updateStage, reload, t }) {
  if (num === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <Label>{t("needSingleFace")}</Label>
          <Switch data-testid="need-sf" checked={!!data.needs_single_face} onCheckedChange={(v) => updateStage({ needs_single_face: v })} />
        </div>
        <ToggleRow label={t("paperArrived")} checked={!!data.paper_arrived} onChange={(v) => updateStage({ paper_arrived: v })} testid="paper-arrived" />
        {data.needs_single_face && (
          <ToggleRow label={t("sfArrived")} checked={!!data.single_face_arrived} onChange={(v) => updateStage({ single_face_arrived: v })} testid="sf-arrived" />
        )}
      </div>
    );
  }
  if (num === 2 || num === 3) {
    return (
      <div className="space-y-4">
        <ToggleRow label={t("arrived")} checked={!!data.arrived} onChange={(v) => updateStage({ arrived: v })} testid="arrived" />
        <div className="space-y-2">
          <Label>{t("arrivalDate")}</Label>
          <Input type="date" data-testid="arrival-date" value={data.arrival_date || ""}
            onChange={(e) => updateStage({ arrival_date: e.target.value })}
            className="h-11 rounded-xl max-w-xs" />
        </div>
      </div>
    );
  }
  if (num === 6) return <MultiStage data={data} options={FINISHING_OPTIONS} field="finishing" label={t("finishingType")} done={done} updateStage={updateStage} t={t} />;
  if (num === 9) return <MultiStage data={data} options={GLUE_OPTIONS} field="glue" label={t("glueType")} done={done} updateStage={updateStage} t={t} />;
  if (num === 5) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 max-w-xs">
          <Label>{t("printMachine")}</Label>
          <Select value={data.print_machine || po.print_machine || "none"} onValueChange={(v) => updateStage({ print_machine: v === "none" ? "" : v })}>
            <SelectTrigger data-testid="stage5-machine" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {MACHINES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <MarkDoneBtn done={done} onToggle={() => updateStage({ done: !done })} t={t} />
      </div>
    );
  }
  if (num === 11) return <DeliveryStage po={po} data={data} reload={reload} t={t} />;
  return <MarkDoneBtn done={done} onToggle={() => updateStage({ done: !done })} t={t} />;
}

function ToggleRow({ label, checked, onChange, testid }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <Label>{label}</Label>
      <Switch data-testid={testid} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function MultiStage({ data, options, field, label, done, updateStage, t }) {
  const selected = data[`${field}_types`] || [];
  const toggle = (opt) => {
    const has = selected.includes(opt);
    updateStage({ [`${field}_types`]: has ? selected.filter((x) => x !== opt) : [...selected, opt] });
  };
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">{label}</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          {options.map((opt) => (
            <div key={opt} onClick={() => toggle(opt)}
              className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer ${selected.includes(opt) ? "border-primary bg-accent" : "border-border"}`}>
              <span data-testid={`opt-${opt}`} className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${selected.includes(opt) ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                {selected.includes(opt) && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sm">{opt}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("custom")}</Label>
        <Input data-testid={`${field}-custom`} value={data[`${field}_custom`] || ""} onChange={(e) => updateStage({ [`${field}_custom`]: e.target.value })} placeholder={t("customPlaceholder")} className="h-11 rounded-xl" />
      </div>
      <MarkDoneBtn done={done} onToggle={() => updateStage({ done: !done })} t={t} />
    </div>
  );
}

import { deliveryResult as deliveryResultApi, scheduleDelivery as scheduleDeliveryApi, updateStage as updateStageApi } from "@/lib/poApi";

function DeliveryStage({ po, data, reload, t }) {
  const attempts = data.delivery_attempts || [];
  const last = attempts.slice(-1)[0];
  const [shipDate, setShipDate] = useState("");
  const [driver, setDriver] = useState("");
  const [failReason, setFailReason] = useState("");

  const togglePrint = async () => {
    try { await updateStageApi(po.id, 11, { print_completed: !data.print_completed }); reload(); toast.success("Tersimpan"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const schedule = async () => {
    if (!shipDate) { toast.error(t("shipDate")); return; }
    try { await scheduleDeliveryApi(po.id, { scheduled_date: shipDate, driver_name: driver }); setShipDate(""); setDriver(""); reload(); toast.success("Jadwal kirim dibuat"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const result = async (status) => {
    if (status === "failed" && !failReason.trim()) { toast.error(t("failReason")); return; }
    try { await deliveryResultApi(po.id, { status, failure_reason: failReason }); setFailReason(""); reload(); toast.success(status === "success" ? "Terkirim" : "Dicatat gagal"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const waiting = last && last.status === "waiting";
  const statusLabel = (s) => s === "success" ? t("shipSuccess") : s === "failed" ? t("shipFailed") : t("waitingShip");
  const statusCls = (s) => s === "success" ? "bg-emerald-500" : s === "failed" ? "bg-red-500" : "bg-amber-500";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <Label className="font-semibold">{t("printCompleted")}</Label>
        <Switch data-testid="print-completed" checked={!!data.print_completed} onCheckedChange={togglePrint} />
      </div>

      {data.print_completed && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" /> {t("delivery")}</div>

          {waiting && (
            <div className="rounded-xl border border-amber-500 bg-amber-500/10 p-4 space-y-3">
              <div className="text-sm">{t("waitingShip")}: <b>{fmtDate(last.scheduled_date)}</b> · {t("driverName")}: <b>{last.driver_name || "-"}</b></div>
              <div className="space-y-2">
                <Label>{t("failReason")} ({t("photoOptional")})</Label>
                <Input data-testid="fail-reason" value={failReason} onChange={(e) => setFailReason(e.target.value)} className="h-11 rounded-xl" placeholder="mis. mobil mogok" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button data-testid="ship-success" onClick={() => result("success")} className="rounded-full gap-2 bg-emerald-500 hover:bg-emerald-600"><Check className="h-4 w-4" /> {t("shipSuccess")}</Button>
                <Button data-testid="ship-failed" onClick={() => result("failed")} variant="outline" className="rounded-full gap-2 text-destructive border-destructive/40"><X className="h-4 w-4" /> {t("shipFailed")}</Button>
              </div>
            </div>
          )}

          {(!last || last.status === "failed" || last.status === "success") && !waiting && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="font-medium text-sm">{last && last.status === "failed" ? t("reschedule") : t("scheduleDelivery")}</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("shipDate")}</Label>
                  <Input type="date" data-testid="ship-date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>{t("driverName")}</Label>
                  <Input data-testid="driver-name" value={driver} onChange={(e) => setDriver(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <Button data-testid="schedule-delivery" onClick={schedule} className="rounded-full gap-2"><Truck className="h-4 w-4" /> {last && last.status === "failed" ? t("reschedule") : t("scheduleDelivery")}</Button>
            </div>
          )}

          {attempts.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">{t("deliveryHistory")}</div>
              <div className="space-y-2">
                {attempts.map((a, i) => (
                  <div key={a.id || i} data-testid={`attempt-${i}`} className="rounded-xl border border-border p-3 text-sm flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-muted-foreground">{t("attempt")} {i + 1}:</span> {fmtDate(a.scheduled_date)} · {t("driverName")}: <b>{a.driver_name || "-"}</b>
                      {a.status === "failed" && a.failure_reason && <div className="text-destructive text-xs mt-0.5">↳ {a.failure_reason}</div>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${statusCls(a.status)}`}>{statusLabel(a.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhotoSection({ po, num, reload, t }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const photos = (po.stage_data?.[String(num)]?.photos) || [];

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await api.uploadPhoto(po.id, num, file); reload(); toast.success("Foto diupload"); }
    catch (err) { toast.error(err?.response?.data?.detail || "Upload gagal"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const del = async (fid) => {
    try { await api.deletePhoto(po.id, num, fid); reload(); toast.success("Foto dihapus"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal hapus"); }
  };

  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-bold">{t("uploadPhoto")} <span className="text-xs font-normal text-muted-foreground">{t("photoOptional")}</span></h3>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="photo-input" />
        <Button data-testid="photo-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="rounded-full gap-2">
          <Upload className="h-4 w-4" /> {uploading ? "…" : "Upload"}
        </Button>
      </div>
      {photos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">{t("photoOptional")}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group rounded-xl overflow-hidden border border-border aspect-square">
              <img
                src={`${API}/po/pos/${po.id}/stages/${num}/photo/${p.id}`}
                alt={p.filename}
                loading="lazy"
                className="h-full w-full object-cover"
                data-testid={`photo-img-${p.id}`}
              />
              <button data-testid={`del-photo-${p.id}`} onClick={() => del(p.id)}
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
