import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { apiError } from "@/context/AuthContext";
import { formatRupiah, todayStr, formatDateID } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const empty = (userName) => ({
  date: todayStr(),
  kode: "",
  jenis_kertas: "", gramatur: "", panjang: "", lebar: "",
  jenis_tinta: "",
  nama_barang: "", satuan: "",
  jenis_transaksi: "masuk",
  jumlah: "",
  supplier: "",
  pic_name: userName || "",
  price_mode: "per_rim",
  price_input: "",
  harga_per_kg: "",
  harga_per_satuan: "",
  ppn_ada: false,
  ppn_nominal: "",
  ref_mutation_id: "",
});

export default function MutationForm({ type, open, onOpenChange, onSaved, editData, jenisOptions = [], keluarOptions = [], masukOptions = [], userName }) {
  const isPaper = type === "paper";
  const isInk = type === "ink";
  const isOther = type === "other";
  const [f, setF] = useState(empty(userName));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editData) setF({ ...empty(userName), ...editData, ppn_ada: !!editData.ppn_ada });
      else setF(empty(userName));
    }
  }, [open, editData, userName]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const unitOf = (o) => isPaper ? "Rim" : isInk ? "Kg" : (o?.satuan || f.satuan || "satuan");
  const nameOf = (o) => isPaper ? o.jenis_kertas : isOther ? o.nama_barang : o.jenis_tinta;
  const optLabel = (o) => `${o.kode ? o.kode : "#" + o.id.slice(0, 6)} • ${formatDateID(o.date)} • ${nameOf(o)} • ${o.jumlah} ${unitOf(o)}`;

  const hargaPerRim = useMemo(() => {
    if (!isPaper || f.jenis_transaksi !== "masuk") return 0;
    const g = Number(f.gramatur || 0), p = Number(f.panjang || 0), l = Number(f.lebar || 0);
    const price = Number(f.price_input || 0), qty = Number(f.jumlah || 0);
    if (f.price_mode === "per_rim") return price;
    if (f.price_mode === "per_kg") return (g * p * l * price) / 20000;
    if (f.price_mode === "total") return qty ? price / qty : 0;
    return 0;
  }, [isPaper, f]);

  // Auto-fill Kode + item identity from referenced mutation
  const pickRef = (id, options) => {
    setF((p) => {
      const sel = options.find((o) => o.id === id);
      if (!sel) return { ...p, ref_mutation_id: id };
      const patch = { ref_mutation_id: id, kode: sel.kode ? sel.kode : p.kode };
      if (isPaper) {
        patch.jenis_kertas = sel.jenis_kertas ?? p.jenis_kertas;
        patch.gramatur = sel.gramatur ?? p.gramatur;
        patch.panjang = sel.panjang ?? p.panjang;
        patch.lebar = sel.lebar ?? p.lebar;
      } else if (isInk) {
        patch.jenis_tinta = sel.jenis_tinta ?? p.jenis_tinta;
      } else {
        patch.nama_barang = sel.nama_barang ?? p.nama_barang;
        patch.satuan = sel.satuan ?? p.satuan;
      }
      return { ...p, ...patch };
    });
  };

  const submit = async () => {
    if (isPaper && (!f.jenis_kertas || !f.gramatur || !f.panjang || !f.lebar)) {
      toast.error("Lengkapi jenis kertas, gramatur, dan ukuran."); return;
    }
    if (isInk && !f.jenis_tinta) { toast.error("Isi jenis tinta."); return; }
    if (isOther && !f.nama_barang) { toast.error("Isi nama barang."); return; }
    if (!f.jumlah || Number(f.jumlah) <= 0) { toast.error("Jumlah harus lebih dari 0."); return; }
    if (f.jenis_transaksi === "masuk") {
      if (isPaper && (!f.price_input || Number(f.price_input) <= 0)) { toast.error("Isi harga untuk transaksi Masuk."); return; }
      if (isInk && (!f.harga_per_kg || Number(f.harga_per_kg) <= 0)) { toast.error("Isi harga per Kg untuk transaksi Masuk."); return; }
      if (isOther && (!f.harga_per_satuan || Number(f.harga_per_satuan) <= 0)) { toast.error("Isi harga per satuan untuk transaksi Masuk."); return; }
    }
    if (f.jenis_transaksi === "retur" && !f.ref_mutation_id) { toast.error("Pilih mutasi Keluar yang direferensikan."); return; }

    const common = {
      date: f.date, kode: f.kode, jenis_transaksi: f.jenis_transaksi, jumlah: Number(f.jumlah),
      supplier: f.supplier, pic_name: f.pic_name,
      ppn_ada: f.ppn_ada, ppn_nominal: Number(f.ppn_nominal || 0),
      ref_mutation_id: f.jenis_transaksi === "retur" ? (f.ref_mutation_id || null) : null,
    };
    let payload;
    if (isPaper) payload = { ...common, jenis_kertas: f.jenis_kertas, gramatur: Number(f.gramatur), panjang: Number(f.panjang), lebar: Number(f.lebar), price_mode: f.price_mode, price_input: Number(f.price_input || 0) };
    else if (isInk) payload = { ...common, jenis_tinta: f.jenis_tinta, harga_per_kg: Number(f.harga_per_kg || 0) };
    else payload = { ...common, nama_barang: f.nama_barang, satuan: f.satuan, harga_per_satuan: Number(f.harga_per_satuan || 0) };

    setSaving(true);
    try {
      const base = `/${type}/mutations`;
      if (editData) await api.put(`${base}/${editData.id}`, payload);
      else await api.post(base, payload);
      toast.success(editData ? "Mutasi diperbarui." : "Mutasi berhasil disimpan.");
      onOpenChange(false);
      onSaved && onSaved();
    } catch (e) {
      toast.error(apiError(e, "Gagal menyimpan mutasi"));
    } finally {
      setSaving(false);
    }
  };

  const unit = isPaper ? "Rim" : isInk ? "Kg" : (f.satuan || "satuan");
  const listId = `jenis-${type}`;
  const title = isPaper ? "Kertas" : isInk ? "Tinta" : "Lain";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="mutation-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{editData ? "Edit" : "Tambah"} Mutasi {title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={f.date} data-testid="mf-date" onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Transaksi</Label>
              <Select value={f.jenis_transaksi} onValueChange={(v) => set("jenis_transaksi", v)}>
                <SelectTrigger data-testid="mf-transaksi"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masuk">Masuk</SelectItem>
                  <SelectItem value="keluar">Keluar</SelectItem>
                  <SelectItem value="retur">Retur/Sisa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isPaper && (
            <>
              <div className="space-y-1.5">
                <Label>Jenis Kertas</Label>
                <Input list={listId} value={f.jenis_kertas} data-testid="mf-jenis-kertas" placeholder="mis. Ivory, HVS, Art Paper" onChange={(e) => set("jenis_kertas", e.target.value)} />
                <datalist id={listId}>{jenisOptions.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Gramatur</Label><Input type="number" value={f.gramatur} data-testid="mf-gramatur" onChange={(e) => set("gramatur", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Panjang (cm)</Label><Input type="number" value={f.panjang} data-testid="mf-panjang" onChange={(e) => set("panjang", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Lebar (cm)</Label><Input type="number" value={f.lebar} data-testid="mf-lebar" onChange={(e) => set("lebar", e.target.value)} /></div>
              </div>
            </>
          )}
          {isInk && (
            <div className="space-y-1.5">
              <Label>Jenis Tinta</Label>
              <Input list={listId} value={f.jenis_tinta} data-testid="mf-jenis-tinta" placeholder="mis. Cyan, Magenta, Black" onChange={(e) => set("jenis_tinta", e.target.value)} />
              <datalist id={listId}>{jenisOptions.map((o) => <option key={o} value={o} />)}</datalist>
            </div>
          )}
          {isOther && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nama Barang</Label>
                <Input list={listId} value={f.nama_barang} data-testid="mf-nama-barang" placeholder="mis. Lem, Plat, Kawat" onChange={(e) => set("nama_barang", e.target.value)} />
                <datalist id={listId}>{jenisOptions.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Satuan</Label>
                <Input value={f.satuan} data-testid="mf-satuan" placeholder="mis. pcs, box, roll" onChange={(e) => set("satuan", e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kode</Label>
            <Input value={f.kode} data-testid="mf-kode" placeholder="Kode mutasi / batch (mis. INV-001)" onChange={(e) => set("kode", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Jumlah ({unit})</Label><Input type="number" value={f.jumlah} data-testid="mf-jumlah" onChange={(e) => set("jumlah", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Nama Admin/PIC</Label><Input value={f.pic_name} data-testid="mf-pic" onChange={(e) => set("pic_name", e.target.value)} /></div>
          </div>

          <div className="space-y-1.5">
            <Label>Supplier {f.jenis_transaksi !== "masuk" && <span className="text-xs text-muted-foreground">(sumber stok terkait)</span>}</Label>
            <Input value={f.supplier} data-testid="mf-supplier" placeholder="Nama supplier" onChange={(e) => set("supplier", e.target.value)} />
          </div>

          {f.jenis_transaksi === "keluar" && (
            <div className="space-y-1.5">
              <Label>Ambil Kode dari Mutasi Masuk <span className="text-xs text-muted-foreground">(opsional)</span></Label>
              <Select value={f.ref_mutation_id} onValueChange={(v) => pickRef(v, masukOptions)}>
                <SelectTrigger data-testid="mf-ref-masuk"><SelectValue placeholder="Pilih mutasi masuk" /></SelectTrigger>
                <SelectContent>
                  {masukOptions.length === 0 && <SelectItem value="none" disabled>Tidak ada mutasi masuk</SelectItem>}
                  {masukOptions.map((k) => <SelectItem key={k.id} value={k.id}>{optLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {f.jenis_transaksi === "retur" && (
            <div className="space-y-1.5">
              <Label>Referensi Mutasi Keluar</Label>
              <Select value={f.ref_mutation_id} onValueChange={(v) => pickRef(v, keluarOptions)}>
                <SelectTrigger data-testid="mf-ref"><SelectValue placeholder="Pilih mutasi keluar" /></SelectTrigger>
                <SelectContent>
                  {keluarOptions.length === 0 && <SelectItem value="none" disabled>Tidak ada mutasi keluar</SelectItem>}
                  {keluarOptions.map((k) => <SelectItem key={k.id} value={k.id}>{optLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {f.jenis_transaksi === "masuk" && (
            <div className="rounded-md border border-border p-3 space-y-3">
              {isPaper && (
                <>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mode Harga</Label>
                  <RadioGroup value={f.price_mode} onValueChange={(v) => set("price_mode", v)} className="grid grid-cols-3 gap-2">
                    {[["per_rim", "Per Rim"], ["per_kg", "Per Kg"], ["total", "Total Kiriman"]].map(([v, l]) => (
                      <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${f.price_mode === v ? "border-primary bg-primary/5" : "border-border"}`}>
                        <RadioGroupItem value={v} data-testid={`mf-mode-${v}`} /> {l}
                      </label>
                    ))}
                  </RadioGroup>
                  <div className="space-y-1.5">
                    <Label>{f.price_mode === "per_rim" && "Harga per Rim (Rp)"}{f.price_mode === "per_kg" && "Harga per Kg (Rp)"}{f.price_mode === "total" && "Total Harga Kiriman (Rp)"}</Label>
                    <Input type="number" value={f.price_input} data-testid="mf-price" onChange={(e) => set("price_input", e.target.value)} />
                  </div>
                  {/* Mode "Total Kiriman": tidak perlu tampilkan konversi per rim. */}
                  {f.price_mode !== "total" && (
                    <div className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="mf-price-preview">Harga per Rim (dihitung): <span className="font-display font-bold">{formatRupiah(hargaPerRim)}</span></div>
                  )}
                </>
              )}
              {isInk && (
                <div className="space-y-1.5"><Label>Harga per Kg (Rp)</Label><Input type="number" value={f.harga_per_kg} data-testid="mf-price" onChange={(e) => set("harga_per_kg", e.target.value)} /></div>
              )}
              {isOther && (
                <div className="space-y-1.5"><Label>Harga per {f.satuan || "Satuan"} (Rp)</Label><Input type="number" value={f.harga_per_satuan} data-testid="mf-price" onChange={(e) => set("harga_per_satuan", e.target.value)} /></div>
              )}

              <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
                <Label htmlFor="ppn-switch" className="cursor-pointer">Ada PPN?</Label>
                <Switch id="ppn-switch" checked={f.ppn_ada} data-testid="mf-ppn-switch" onCheckedChange={(v) => set("ppn_ada", v)} />
              </div>
              {f.ppn_ada && (
                <div className="space-y-1.5"><Label>Nominal PPN (Rp)</Label><Input type="number" value={f.ppn_nominal} data-testid="mf-ppn-nominal" onChange={(e) => set("ppn_nominal", e.target.value)} /></div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="mf-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="mf-submit">{saving ? "Menyimpan…" : "Simpan Mutasi"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
