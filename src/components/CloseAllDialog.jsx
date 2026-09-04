import { useEffect, useState } from "react";
import { FileDown, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/**
 * Dialog "Tutup & Reset Data" — konsep sama dengan Tutup Tahun:
 * Langkah 1 wajib unduh PDF laporan, baru Langkah 2 (hapus semua data) aktif.
 *
 * Props:
 * - open / onOpenChange       : kontrol dialog
 * - title / description       : judul & deskripsi dialog
 * - downloadLabel             : label tombol unduh (mis. "Unduh PDF Rekap PO")
 * - onDownload()              : async — memicu unduhan PDF
 * - deleteLabel               : label tombol hapus (mis. "Hapus Semua Data PO")
 * - confirmTitle / confirmDescription : isi dialog konfirmasi akhir
 * - onDelete()                : async — memanggil endpoint penghapusan
 * - testidPrefix              : prefix data-testid
 */
export default function CloseAllDialog({
  open, onOpenChange, title, description,
  downloadLabel, onDownload,
  deleteLabel, confirmTitle, confirmDescription, onDelete,
  testidPrefix = "close-all",
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reset langkah setiap kali dialog dibuka ulang.
  useEffect(() => { if (open) { setDownloaded(false); setBusy(false); setConfirmOpen(false); } }, [open]);

  const doDownload = async () => {
    setBusy(true);
    try {
      await onDownload();
      setDownloaded(true);
      toast.success("PDF laporan terunduh.");
    } catch (e) { toast.error(apiError(e, "Gagal unduh PDF")); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await onDelete();
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent data-testid={`${testidPrefix}-dialog`} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${downloaded ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                <span className={downloaded ? "" : "text-muted-foreground"}>
                  Langkah 1 — Unduh PDF laporan sebagai arsip (wajib).
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={busy}
                data-testid={`${testidPrefix}-download`}
                onClick={doDownload}
              >
                <FileDown className="h-4 w-4" /> {busy && !downloaded ? "Menyiapkan..." : downloadLabel}
              </Button>
            </div>

            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${downloaded ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                <span className={downloaded ? "" : "text-muted-foreground"}>
                  Langkah 2 — Hapus seluruh data secara permanen.
                </span>
              </div>
              <Button
                variant="destructive"
                className="w-full gap-2"
                disabled={!downloaded || busy}
                data-testid={`${testidPrefix}-delete`}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> {deleteLabel}
              </Button>
              {!downloaded && (
                <p className="text-xs text-muted-foreground">Unduh PDF terlebih dahulu untuk mengaktifkan tombol ini.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <AlertDialogContent data-testid={`${testidPrefix}-confirm-dialog`}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`${testidPrefix}-confirm`}
              disabled={busy}
              onClick={(e) => { e.preventDefault(); doDelete(); }}
            >
              {busy ? "Menghapus..." : "Ya, Hapus Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
