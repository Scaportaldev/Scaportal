import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle2, Check } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/poApi";
import { useLang } from "@/context/LangContext";
import { MACHINES } from "@/lib/poStages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function PoForm() {
  const { id } = useParams();
  const editing = !!id;
  const { t, stageName } = useLang();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    po_number: "", client_name: "", item_type: "", material: "", paper_size: "",
    quantity: "", po_date: "", est_start: "", est_end: "", print_machine: "none",
    enabled_stages: [1, 4, 5, 6, 10, 11], notes: "",
  });
  const [conflicts, setConflicts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      api.getPo(id).then((p) => {
        setForm({
          po_number: p.po_number, client_name: p.client_name, item_type: p.item_type || "",
          material: p.material || "", paper_size: p.paper_size || "", quantity: p.quantity || "",
          po_date: p.po_date || "", est_start: p.est_start || "", est_end: p.est_end || "",
          print_machine: p.print_machine || "none",
          enabled_stages: p.enabled_stages || [], notes: p.notes || "",
        });
      }).catch((e) => toast.error(e?.response?.data?.detail || "Gagal load"));
    }
  }, [id, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const checkConflict = useCallback(async (start, end) => {
    if (!start || !end) { setConflicts([]); return; }
    try {
      const data = await api.checkConflict({ est_start: start, est_end: end, exclude_id: id });
      setConflicts(data.conflicts || []);
    } catch {}
  }, [id]);

  useEffect(() => { checkConflict(form.est_start, form.est_end); }, [form.est_start, form.est_end, checkConflict]);

  const toggleStage = (n) => {
    setForm((f) => {
      const has = f.enabled_stages.includes(n);
      return { ...f, enabled_stages: has ? f.enabled_stages.filter((x) => x !== n) : [...f.enabled_stages, n].sort((a, b) => a - b) };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.po_number.trim() || !form.client_name.trim()) { toast.error("Nomor PO & Nama Klien wajib diisi"); return; }
    setSaving(true);
    const payload = { ...form, print_machine: form.print_machine === "none" ? null : form.print_machine };
    try {
      if (editing) {
        await api.updatePo(id, payload);
        toast.success("PO diperbarui");
        navigate(`/po/pos/${id}`);
      } else {
        const data = await api.createPo(payload);
        toast.success("PO dibuat");
        navigate(`/po/pos/${data.id}`);
      }
    } catch (err) { toast.error(err?.response?.data?.detail || "Gagal simpan"); }
    finally { setSaving(false); }
  };

  const field = (key, label, type = "text") => (
    <div className="space-y-2 min-w-0">
      <Label>{label}</Label>
      <Input data-testid={`po-field-${key}`} type={type} value={form[key]} onChange={(e) => set(key, e.target.value)} className="h-11 rounded-xl w-full min-w-0" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="po-form-page">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">{editing ? t("edit") : t("newPO")}</h1>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <Card className="rounded-2xl p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {field("po_number", t("poNumber") + " *")}
            {field("client_name", t("clientName") + " *")}
            {field("item_type", t("itemType"))}
            {field("material", t("material"))}
            {field("paper_size", t("paperSize"))}
            {field("quantity", t("quantity"))}
            {field("po_date", t("poDate"), "date")}
            <div className="space-y-2 min-w-0">
              <Label>{t("printMachine")}</Label>
              <Select value={form.print_machine} onValueChange={(v) => set("print_machine", v)}>
                <SelectTrigger data-testid="po-field-print_machine" className="h-11 rounded-xl w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {MACHINES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field("est_start", t("estStart"), "date")}
            {field("est_end", t("estEnd"), "date")}
          </div>

          {conflicts.length > 0 && (
            <div data-testid="po-conflict-warning" className="rounded-xl border border-amber-500 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" /> {t("conflictTitle")}
              </div>
              <p className="text-sm mt-1 text-muted-foreground">{t("conflictDesc")}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {conflicts.map((c) => (
                  <li key={c.id} className="flex flex-wrap gap-x-2">
                    <span className="font-semibold">{c.po_number}</span>
                    <span>· {c.client_name}</span>
                    <span className="text-muted-foreground">· {c.est_start} → {c.est_end}</span>
                    {c.print_machine && <span className="text-muted-foreground">· {t("machine")}: {c.print_machine}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {form.est_start && form.est_end && conflicts.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {t("noConflict")}</div>
          )}
          <div className="space-y-2">
            <Label>{t("notes")}</Label>
            <Textarea data-testid="po-field-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="rounded-xl min-h-[80px]" />
          </div>
        </Card>

        <Card className="rounded-2xl p-6">
          <Label className="text-base font-semibold">{t("stagesUsed")}</Label>
          <p className="text-sm text-muted-foreground mt-1 mb-4">1–11 · centang tahapan yang dipakai PO ini</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {STAGES.map((n) => {
              const checked = form.enabled_stages.includes(n);
              return (
                <div key={n} data-testid={`po-stage-check-${n}`} onClick={() => toggleStage(n)}
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${checked ? "border-primary bg-accent" : "border-border hover:bg-accent/40"}`}>
                  <span className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-sm"><span className="text-muted-foreground">{n}.</span> {stageName(n)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="rounded-full flex-1" onClick={() => navigate(-1)}>{t("cancel")}</Button>
          <Button type="submit" data-testid="po-save" disabled={saving} className="rounded-full flex-1">{saving ? t("saving") : t("save")}</Button>
        </div>
      </form>
    </div>
  );
}
