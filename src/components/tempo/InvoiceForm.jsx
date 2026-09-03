import { useEffect, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiError } from "@/context/AuthContext";
import { createInvoice, updateInvoice, addTopOption } from "@/lib/tempoApi";
import { formatRp } from "@/lib/format";
import { formatNumberInput, parseNumberInput, todayISO } from "@/lib/tempoFormat";

const empty = {
  client_name: "", top: "Cash", po_date: "", po_number: "",
  delivery_note_number: "", invoice_number: "", invoice_date: todayISO(),
  total_amount: 0, due_date: "", status: "belum_lunas", installments: [],
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default function InvoiceForm({ open, onOpenChange, invoice, topOptions = [], refetchTop, onSaved }) {
  const [form, setForm] = useState(empty);
  const [amountText, setAmountText] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingTop, setAddingTop] = useState(false);
  const [newTop, setNewTop] = useState("");

  useEffect(() => {
    if (!open) return;
    const base = invoice ? { ...empty, ...invoice } : { ...empty, invoice_date: todayISO() };
    setForm(base);
    setAmountText(base.total_amount ? Number(base.total_amount).toLocaleString("id-ID") : "");
    setAddingTop(false);
    setNewTop("");
  }, [open, invoice]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const installmentsTotal = (form.installments || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const remaining = (Number(form.total_amount) || 0) - installmentsTotal;

  const addInstallmentRow = () =>
    set("installments", [
      ...(form.installments || []),
      { sequence: (form.installments?.length || 0) + 1, amount: 0, date: todayISO(), _amountText: "" },
    ]);

  const updateInstallment = (idx, patch) => {
    const list = [...(form.installments || [])];
    list[idx] = { ...list[idx], ...patch };
    set("installments", list);
  };

  const removeInstallment = (idx) =>
    set(
      "installments",
      (form.installments || []).filter((_, i) => i !== idx).map((it, i) => ({ ...it, sequence: i + 1 })),
    );

  const handleAddTop = async () => {
    const v = newTop.trim();
    if (!v) return;
    try {
      await addTopOption(v);
      await refetchTop?.();
      set("top", v);
      setAddingTop(false);
      setNewTop("");
      toast.success(`Opsi "${v}" ditambahkan`);
    } catch (e) {
      toast.error(apiError(e, "Gagal menambah opsi TOP"));
    }
  };

  const handleSave = async () => {
    if (!String(form.client_name || "").trim()) return toast.error("Nama Klien wajib diisi");
    setSaving(true);
    try {
      const payload = {
        ...form,
        total_amount: Number(form.total_amount) || 0,
        installments: (form.installments || []).map(({ _amountText, ...rest }) => ({
          ...rest,
          sequence: Number(rest.sequence),
          amount: Number(rest.amount) || 0,
        })),
      };
      if (invoice?.id) await updateInvoice(invoice.id, payload);
      else await createInvoice(payload);
      toast.success(invoice ? "Invoice diperbarui" : "Invoice ditambahkan");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(apiError(e, "Gagal menyimpan invoice"));
    } finally {
      setSaving(false);
    }
  };

  const topList = Array.from(new Set([...(form.top ? [form.top] : []), ...topOptions]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl" data-testid="invoice-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{invoice ? "Edit Invoice" : "Tambah Invoice"}</DialogTitle>
          <DialogDescription>Lengkapi data invoice, jatuh tempo, dan (bila cicilan) rincian pembayaran.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nama Klien *">
            <Input data-testid="form-client-name" value={form.client_name}
              onChange={(e) => set("client_name", e.target.value)} placeholder="PT Contoh Jaya" />
          </Field>

          <Field label="TOP / Sistem Pembayaran">
            {addingTop ? (
              <div className="flex gap-2">
                <Input autoFocus data-testid="form-new-top" value={newTop}
                  onChange={(e) => setNewTop(e.target.value)} placeholder="mis. Net 45"
                  onKeyDown={(e) => e.key === "Enter" && handleAddTop()} />
                <Button type="button" size="icon" variant="secondary" data-testid="form-new-top-save" onClick={handleAddTop}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setAddingTop(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={form.top} onValueChange={(v) => set("top", v)}>
                  <SelectTrigger data-testid="form-top-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {topList.map((o) => (
                      <SelectItem key={o} value={o} data-testid={`top-option-${o}`}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="secondary" title="Tambah opsi"
                  data-testid="form-add-top-btn" onClick={() => setAddingTop(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Field>

          <Field label="Nominal Total (Rp)">
            <Input data-testid="form-total-amount" inputMode="numeric" value={amountText} placeholder="0"
              onChange={(e) => {
                setAmountText(formatNumberInput(e.target.value));
                set("total_amount", parseNumberInput(e.target.value));
              }} />
          </Field>

          <Field label="No. Invoice">
            <Input data-testid="form-invoice-number" value={form.invoice_number || ""}
              onChange={(e) => set("invoice_number", e.target.value)} placeholder="INV-001" />
          </Field>

          <Field label="Tanggal Invoice">
            <Input type="date" data-testid="form-invoice-date" value={form.invoice_date || ""}
              onChange={(e) => set("invoice_date", e.target.value)} />
          </Field>

          <Field label="Tanggal Jatuh Tempo">
            <Input type="date" data-testid="form-due-date" value={form.due_date || ""}
              onChange={(e) => set("due_date", e.target.value)} />
          </Field>

          <Field label="Tanggal PO">
            <Input type="date" data-testid="form-po-date" value={form.po_date || ""}
              onChange={(e) => set("po_date", e.target.value)} />
          </Field>

          <Field label="No. PO">
            <Input data-testid="form-po-number" value={form.po_number || ""}
              onChange={(e) => set("po_number", e.target.value)} placeholder="PO-001" />
          </Field>

          <Field label="No. Surat Jalan">
            <Input data-testid="form-dn-number" value={form.delivery_note_number || ""}
              onChange={(e) => set("delivery_note_number", e.target.value)} placeholder="SJ-001" />
          </Field>

          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/50 px-3 py-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Status</div>
                <div className="text-sm font-semibold">{form.status === "lunas" ? "Lunas" : "Belum Lunas"}</div>
              </div>
              <Switch data-testid="form-status-switch" checked={form.status === "lunas"}
                onCheckedChange={(v) => set("status", v ? "lunas" : "belum_lunas")} />
            </div>
          </div>
        </div>

        {form.top === "Cicilan" && (
          <Card className="mt-2 rounded-2xl p-4" data-testid="installments-section">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">Pembayaran Cicilan</h3>
              <Button type="button" size="sm" variant="secondary" className="rounded-full"
                data-testid="add-installment-btn" onClick={addInstallmentRow}>
                <Plus className="mr-1 h-4 w-4" /> Tambah Cicilan
              </Button>
            </div>

            {(form.installments || []).length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada cicilan. Klik &quot;Tambah Cicilan&quot;.</p>
            )}

            <div className="space-y-2">
              {(form.installments || []).map((ins, idx) => (
                <div key={ins.id || idx} className="grid grid-cols-12 items-center gap-2"
                  data-testid={`installment-row-${idx}`}>
                  <div className="col-span-2 text-center text-sm font-semibold text-muted-foreground">#{ins.sequence}</div>
                  <div className="col-span-5">
                    <Input inputMode="numeric" placeholder="Nominal" data-testid={`installment-amount-${idx}`}
                      value={ins._amountText ?? (ins.amount ? Number(ins.amount).toLocaleString("id-ID") : "")}
                      onChange={(e) => updateInstallment(idx, {
                        _amountText: formatNumberInput(e.target.value),
                        amount: parseNumberInput(e.target.value),
                      })} />
                  </div>
                  <div className="col-span-4">
                    <Input type="date" data-testid={`installment-date-${idx}`} value={ins.date || ""}
                      onChange={(e) => updateInstallment(idx, { date: e.target.value })} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button type="button" size="icon" variant="ghost" className="text-destructive"
                      data-testid={`remove-installment-${idx}`} onClick={() => removeInstallment(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">
                Terbayar: <b className="text-emerald-600 dark:text-emerald-400">{formatRp(installmentsTotal)}</b>
              </span>
              <span className="text-muted-foreground">
                Sisa Tagihan:{" "}
                <b data-testid="form-remaining"
                  className={remaining <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {formatRp(Math.max(remaining, 0))}
                </b>
              </span>
              {remaining <= 0 && Number(form.total_amount) > 0 && (
                <span className="text-xs text-muted-foreground">Status akan otomatis menjadi Lunas saat disimpan.</span>
              )}
            </div>
          </Card>
        )}

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}
            data-testid="form-cancel-btn">Batal</Button>
          <Button className="rounded-full" onClick={handleSave} disabled={saving} data-testid="form-save-btn">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
