import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiError } from "@/context/AuthContext";
import * as kapi from "@/lib/klienApi";
import { fmtQty } from "@/lib/klienApi";

const today = () => new Date().toISOString().slice(0, 10);

const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toLocalInput = (iso) => {
  if (!iso) return localNow();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return localNow();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/* ------------------------------- Klien ------------------------------- */
export function KlienDialog({ open, onOpenChange, klien, onSaved }) {
  const [nama, setNama] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!klien;

  useEffect(() => { if (open) setNama(klien?.nama || ""); }, [open, klien]);

  const submit = async (e) => {
    e.preventDefault();
    if (!nama.trim()) return toast.error("Nama klien wajib diisi");
    setSaving(true);
    try {
      if (isEdit) {
        await kapi.updateKlien(klien.id, { nama });
        toast.success("Klien berhasil diperbarui");
      } else {
        await kapi.createKlien({ nama });
        toast.success("Klien berhasil ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan klien"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="klien-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Edit Klien" : "Tambah Klien Baru"}</DialogTitle>
          <DialogDescription>{isEdit ? "Perbarui nama klien." : "Masukkan nama klien baru."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="klien-nama">Nama Klien</Label>
            <Input id="klien-nama" data-testid="klien-nama-input" value={nama} autoFocus
              onChange={(e) => setNama(e.target.value)} placeholder="Contoh: PT Maju Bersama" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full"
              onClick={() => onOpenChange(false)} data-testid="klien-cancel-btn">Batal</Button>
            <Button type="submit" className="rounded-full" disabled={saving} data-testid="klien-submit-btn">
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Klien"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- PO -------------------------------- */
export function PODialog({ open, onOpenChange, kliens, fixedKlien, po, onSaved }) {
  const [klienId, setKlienId] = useState("");
  const [newKlien, setNewKlien] = useState("");
  const [noPo, setNoPo] = useState("");
  const [tanggal, setTanggal] = useState(today());
  const [saving, setSaving] = useState(false);
  const isEdit = !!po;

  useEffect(() => {
    if (!open) return;
    setKlienId(fixedKlien?.id || po?.klien_id || "");
    setNewKlien("");
    setNoPo(po?.no_po || "");
    setTanggal(po?.tanggal_po?.slice(0, 10) || today());
  }, [open, po, fixedKlien]);

  const showKlienSelect = !isEdit && !fixedKlien;

  const submit = async (e) => {
    e.preventDefault();
    if (!noPo.trim()) return toast.error("No PO wajib diisi");
    if (!tanggal) return toast.error("Tanggal PO wajib diisi");
    setSaving(true);
    try {
      if (isEdit) {
        await kapi.updateKlienPo(po.id, { no_po: noPo, tanggal_po: tanggal });
        toast.success("PO berhasil diperbarui");
      } else {
        let kid = fixedKlien?.id || klienId;
        if (klienId === "__new") {
          if (!newKlien.trim()) { setSaving(false); return toast.error("Nama klien baru wajib diisi"); }
          const created = await kapi.createKlien({ nama: newKlien });
          kid = created.id;
        }
        if (!kid) { setSaving(false); return toast.error("Pilih klien terlebih dahulu"); }
        await kapi.createKlienPo({ klien_id: kid, no_po: noPo, tanggal_po: tanggal });
        toast.success("PO berhasil ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan PO"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="klien-po-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? `Edit PO No. ${po?.no_po}` : fixedKlien ? `Tambah PO — ${fixedKlien.nama}` : "Tambah Klien / PO Baru"}
          </DialogTitle>
          <DialogDescription>Lengkapi data Purchase Order (No PO dan tanggal).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {showKlienSelect && (
            <div className="space-y-1.5">
              <Label>Klien</Label>
              <Select value={klienId} onValueChange={setKlienId}>
                <SelectTrigger data-testid="po-klien-select"><SelectValue placeholder="Pilih klien..." /></SelectTrigger>
                <SelectContent>
                  {(kliens || []).map((k) => (
                    <SelectItem key={k.id} value={k.id} data-testid={`po-klien-option-${k.id}`}>{k.nama}</SelectItem>
                  ))}
                  <SelectItem value="__new" data-testid="po-klien-option-new">+ Klien baru...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {showKlienSelect && klienId === "__new" && (
            <div className="space-y-1.5">
              <Label htmlFor="po-new-klien">Nama Klien Baru</Label>
              <Input id="po-new-klien" data-testid="po-new-klien-input" value={newKlien}
                onChange={(e) => setNewKlien(e.target.value)} placeholder="Contoh: CV Sumber Rezeki" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-no">No PO</Label>
              <Input id="po-no" data-testid="po-no-input" value={noPo}
                onChange={(e) => setNoPo(e.target.value)} placeholder="Contoh: 001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-tanggal">Tanggal PO</Label>
              <Input id="po-tanggal" type="date" data-testid="po-tanggal-input" value={tanggal}
                onChange={(e) => setTanggal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full"
              onClick={() => onOpenChange(false)} data-testid="po-cancel-btn">Batal</Button>
            <Button type="submit" className="rounded-full" disabled={saving} data-testid="po-submit-btn">
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Item ------------------------------- */
export function ItemDialog({ open, onOpenChange, po, item, onSaved }) {
  const [form, setForm] = useState({ jenis_item: "", satuan: "", kuantiti: "0", keterangan: "", status: "aktif" });
  const [saving, setSaving] = useState(false);
  const isEdit = !!item;

  useEffect(() => {
    if (!open) return;
    setForm({
      jenis_item: item?.jenis_item || "",
      satuan: item?.satuan || "",
      kuantiti: String(item?.kuantiti ?? 0),
      keterangan: item?.keterangan || "",
      status: item?.status || "aktif",
    });
  }, [open, item]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.jenis_item.trim()) return toast.error("Jenis item wajib diisi");
    const qty = parseFloat(form.kuantiti);
    if (Number.isNaN(qty) || qty < 0) return toast.error("Kuantiti tidak valid");
    setSaving(true);
    try {
      if (isEdit) {
        await kapi.updateKlienItem(item.id, {
          jenis_item: form.jenis_item, satuan: form.satuan, kuantiti: qty,
          keterangan: form.keterangan, status: form.status,
        });
        toast.success("Item berhasil diperbarui");
      } else {
        await kapi.createKlienItem({
          po_id: po.id, jenis_item: form.jenis_item, satuan: form.satuan,
          kuantiti: qty, keterangan: form.keterangan, status: "aktif",
        });
        toast.success("Item berhasil ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan item"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="item-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? `Edit Item — ${item?.jenis_item}` : `Tambah Item — PO No. ${po?.no_po}`}
          </DialogTitle>
          <DialogDescription>Lengkapi jenis item, satuan, kuantiti stok, dan keterangan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-jenis">Jenis Item</Label>
            <Input id="item-jenis" data-testid="item-jenis-input" value={form.jenis_item}
              onChange={set("jenis_item")} placeholder="Contoh: Kain Katun" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-satuan">Satuan</Label>
              <Input id="item-satuan" data-testid="item-satuan-input" value={form.satuan}
                onChange={set("satuan")} placeholder="pcs, box, kg, roll..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-kuantiti">{isEdit ? "Kuantiti Stok" : "Stok Awal"}</Label>
              <Input id="item-kuantiti" type="number" min="0" step="any" data-testid="item-kuantiti-input"
                value={form.kuantiti} onChange={set("kuantiti")} />
            </div>
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={set("status")}>
                <SelectTrigger data-testid="item-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif" data-testid="item-status-aktif">Aktif</SelectItem>
                  <SelectItem value="selesai" data-testid="item-status-selesai">Selesai/Ditutup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="item-ket">Keterangan (opsional)</Label>
            <Textarea id="item-ket" data-testid="item-keterangan-input" rows={2}
              value={form.keterangan} onChange={set("keterangan")} placeholder="Catatan tambahan..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full"
              onClick={() => onOpenChange(false)} data-testid="item-cancel-btn">Batal</Button>
            <Button type="submit" className="rounded-full" disabled={saving} data-testid="item-submit-btn">
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Mutasi ------------------------------ */
export function MutationDialog({ open, onOpenChange, item, po, klien, jenis, mutation, onSaved }) {
  const [form, setForm] = useState({ jenis: "masuk", jumlah: "", tanggal: localNow(), keterangan: "" });
  const [saving, setSaving] = useState(false);
  const isEdit = !!mutation;

  useEffect(() => {
    if (!open) return;
    setForm({
      jenis: mutation?.jenis || jenis || "masuk",
      jumlah: mutation ? String(mutation.jumlah) : "",
      tanggal: toLocalInput(mutation?.tanggal),
      keterangan: mutation?.keterangan || "",
    });
  }, [open, mutation, jenis]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const title = isEdit
    ? `Edit Mutasi — ${mutation?.jenis_item || ""}`
    : `Mutasi ${jenis === "masuk" ? "Masuk" : "Keluar"} — ${item?.jenis_item ?? ""}`;

  const submit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(form.jumlah);
    if (Number.isNaN(qty) || qty <= 0) return toast.error("Jumlah harus lebih dari 0");
    const tanggalIso = form.tanggal ? new Date(form.tanggal).toISOString() : undefined;
    setSaving(true);
    try {
      if (isEdit) {
        await kapi.updateKlienMutation(mutation.id, {
          jenis: form.jenis, jumlah: qty, tanggal: tanggalIso, keterangan: form.keterangan,
        });
        toast.success("Mutasi berhasil diperbarui");
      } else {
        await kapi.createKlienMutation({
          item_id: item.id, jenis: form.jenis, jumlah: qty, tanggal: tanggalIso, keterangan: form.keterangan,
        });
        toast.success(`Mutasi ${form.jenis === "masuk" ? "masuk" : "keluar"} berhasil dicatat`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Gagal menyimpan mutasi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="mutation-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>Catat mutasi stok beserta jumlah, tanggal, dan keterangan.</DialogDescription>
        </DialogHeader>
        {!isEdit && item && (
          <p className="-mt-1 text-sm text-muted-foreground">
            {klien?.nama} · PO No. {po?.no_po} · Stok saat ini:{" "}
            <span className="font-semibold text-foreground">{fmtQty(item.kuantiti)} {item.satuan}</span>
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Jenis Mutasi</Label>
              <Select value={form.jenis} onValueChange={set("jenis")}>
                <SelectTrigger data-testid="mutation-jenis-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masuk" data-testid="mutation-jenis-masuk">Masuk</SelectItem>
                  <SelectItem value="keluar" data-testid="mutation-jenis-keluar">Keluar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mut-jumlah">Jumlah</Label>
              <Input id="mut-jumlah" type="number" min="0" step="any" autoFocus
                data-testid="mutation-jumlah-input" value={form.jumlah} onChange={set("jumlah")} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mut-tanggal">Tanggal &amp; Waktu</Label>
              <Input id="mut-tanggal" type="datetime-local" data-testid="mutation-tanggal-input"
                value={form.tanggal} onChange={set("tanggal")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mut-ket">Keterangan (opsional)</Label>
            <Textarea id="mut-ket" rows={2} data-testid="mutation-keterangan-input"
              value={form.keterangan} onChange={set("keterangan")}
              placeholder="Contoh: Kiriman supplier / diambil klien" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full"
              onClick={() => onOpenChange(false)} data-testid="mutation-cancel-btn">Batal</Button>
            <Button type="submit" disabled={saving} data-testid="mutation-submit-btn"
              className={`rounded-full ${
                !isEdit && form.jenis === "keluar"
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : !isEdit
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : ""
              }`}>
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : `Catat Mutasi ${form.jenis === "masuk" ? "Masuk" : "Keluar"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Konfirmasi hapus ---------------------------- */
export function ConfirmDeleteDialog({ open, onOpenChange, title, description, onConfirm, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      toast.success("Data berhasil dihapus");
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err, "Gagal menghapus data"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full" data-testid="delete-cancel-btn">Batal</AlertDialogCancel>
          <AlertDialogAction disabled={deleting} data-testid="delete-confirm-btn"
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); confirm(); }}>
            {deleting ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
