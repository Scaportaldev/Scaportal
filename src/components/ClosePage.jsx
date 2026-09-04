import { useState } from "react";
import { Archive, FileDown, Trash2, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, apiError } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/**
 * Halaman "Tutup & Reset Data" — pola sama dengan Tutup Tahun:
 * Langkah 1 wajib unduh PDF laporan (arsip), baru Langkah 2 (hapus semua data) aktif.
 * Dipakai oleh menu sidebar "Tutup PO" dan "Tutup Data Klien". Khusus Superadmin.
 */
export default function ClosePage({
  testid, pageTitle, pageDescription,
  downloadLabel, downloadNote, onDownload,
  deleteLabel, deleteNote, confirmTitle, confirmDescription, onDelete,
  testidPrefix = "close",
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuper = user?.role === "superadmin";
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      await onDelete(queryClient);
      setConfirmOpen(false);
      setDownloaded(false);
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  const Step = ({ done, children }) => (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className={`h-4 w-4 shrink-0 ${done ? "text-emerald-500" : "text-muted-foreground/40"}`} />
      <span className={done ? "" : "text-muted-foreground"}>{children}</span>
    </div>
  );

  if (!isSuper) {
    return (
      <PageContainer testid={testid} className="mx-auto w-full max-w-2xl" pageTitle={pageTitle} pageDescription={pageDescription}>
        <Card className="flex items-center gap-3 p-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-amber-500/15 text-amber-600"><ShieldAlert className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display font-bold">Khusus Superadmin</h3>
            <p className="text-sm text-muted-foreground">Hanya Superadmin yang dapat menutup & menghapus seluruh data pada tools ini.</p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer testid={testid} className="mx-auto w-full max-w-2xl" pageTitle={pageTitle} pageDescription={pageDescription}>
      <Card className="min-h-[248px] space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-amber-500/15 text-amber-600"><Archive className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-lg font-bold">Langkah 1 — Unduh Laporan</h3>
            <p className="text-sm text-muted-foreground">Wajib unduh PDF laporan sebagai arsip sebelum menghapus data.</p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border p-4">
          <Step done={downloaded}>{downloadNote}</Step>
        </div>

        <Button variant="outline" className="gap-2" data-testid={`${testidPrefix}-download`} disabled={busy} onClick={doDownload}>
          <FileDown className="h-4 w-4" /> {busy && !downloaded ? "Menyiapkan..." : downloadLabel}
        </Button>
      </Card>

      <Card className="min-h-[202px] space-y-4 p-6">
        <div>
          <h3 className="font-display text-lg font-bold">Langkah 2 — Hapus Semua Data</h3>
          <p className="text-sm text-muted-foreground">{deleteNote}</p>
        </div>
        <Button variant="destructive" className="gap-2" data-testid={`${testidPrefix}-delete`} disabled={!downloaded || busy}
          onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" /> {deleteLabel}
        </Button>
        {!downloaded && <p className="text-xs text-muted-foreground">Unduh laporan terlebih dahulu untuk mengaktifkan tombol ini.</p>}
      </Card>

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
              {busy ? "Menghapus..." : "Ya, Hapus & Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
