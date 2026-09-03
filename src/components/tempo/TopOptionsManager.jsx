import { useCallback, useEffect, useState } from "react";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiError } from "@/context/AuthContext";
import {
  getTopOptions, addTopOption, renameTopOption, deleteTopOption,
} from "@/lib/tempoApi";

export default function TopOptionsManager({ open, onOpenChange, onChanged }) {
  const [options, setOptions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOptions(await getTopOptions());
    } catch (e) {
      toast.error(apiError(e, "Gagal memuat opsi TOP"));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    setEditing(null);
    setEditText("");
    setNewValue("");
  }, [open, load]);

  const notify = (vals) => { setOptions(vals); onChanged?.(vals); };

  const saveEdit = async () => {
    const val = editText.trim();
    if (!val || val === editing) { setEditing(null); return; }
    setBusy(true);
    try {
      notify(await renameTopOption(editing, val));
      setEditing(null);
      toast.success("Opsi diperbarui. Invoice terkait ikut diperbarui.");
    } catch (e) {
      toast.error(apiError(e, "Gagal mengubah opsi"));
    } finally { setBusy(false); }
  };

  const handleDelete = async (o) => {
    setBusy(true);
    try {
      notify(await deleteTopOption(o));
      toast.success(`Opsi "${o}" dihapus`);
    } catch (e) {
      toast.error(apiError(e, "Gagal menghapus opsi"));
    } finally { setBusy(false); }
  };

  const handleAdd = async () => {
    const val = newValue.trim();
    if (!val) return;
    setBusy(true);
    try {
      notify(await addTopOption(val));
      setNewValue("");
      toast.success(`Opsi "${val}" ditambahkan`);
    } catch (e) {
      toast.error(apiError(e, "Gagal menambah opsi"));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl" data-testid="top-manager-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Kelola Opsi Pembayaran</DialogTitle>
          <DialogDescription>Ubah, tambah, atau hapus pilihan TOP / sistem pembayaran.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2" data-testid="top-manager-list">
          {options.map((o) => {
            const locked = o === "Cicilan";
            const isEditing = editing === o;
            return (
              <div key={o} data-testid={`top-item-${o}`}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                {isEditing ? (
                  <>
                    <Input autoFocus value={editText} data-testid="top-edit-input"
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    <Button size="icon" variant="secondary" disabled={busy} data-testid="top-edit-save" onClick={saveEdit}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{o}</span>
                    {locked ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" /> terkunci
                      </span>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" data-testid={`top-edit-${o}`}
                          onClick={() => { setEditing(o); setEditText(o); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" disabled={busy}
                          data-testid={`top-delete-${o}`} onClick={() => handleDelete(o)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          <Input placeholder="Opsi baru, mis. Net 45" data-testid="top-add-input" value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          <Button className="rounded-full" data-testid="top-add-btn" disabled={busy} onClick={handleAdd}>
            <Plus className="mr-1 h-4 w-4" /> Tambah
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Opsi &quot;Cicilan&quot; terkunci karena memicu form pembayaran bertahap.
        </p>
      </DialogContent>
    </Dialog>
  );
}
