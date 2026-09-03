import { useState } from "react";
import { CalendarX, FileDown, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api, { downloadPdf } from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import SectionGate from "@/components/SectionGate";
import { Card } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

function Inner() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";
  const year = new Date().getFullYear();
  const [steps, setSteps] = useState({ paper: false, ink: false, nominal: false });
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const dlMutations = async () => {
    setBusy(true);
    try {
      await downloadPdf("/pdf/paper-mutations", {}, `laporan-mutasi-kertas-${year}.pdf`);
      setSteps((s) => ({ ...s, paper: true }));
      await downloadPdf("/pdf/ink-mutations", {}, `laporan-mutasi-tinta-${year}.pdf`);
      setSteps((s) => ({ ...s, ink: true }));
      toast.success("PDF mutasi kertas & tinta terunduh.");
    } catch (e) { toast.error(apiError(e, "Gagal unduh PDF mutasi")); }
    finally { setBusy(false); }
  };

  /** Unduh PDF nominal tanpa cek password (superadmin / setelah verifikasi). */
  const runNominalDownload = async () => {
    try {
      await downloadPdf("/pdf/stock-nominal", {}, `laporan-stok-keseluruhan-${year}.pdf`);
      setSteps((s) => ({ ...s, nominal: true }));
      setPwdOpen(false); setPwd("");
      toast.success("PDF stok keseluruhan (nominal) terunduh.");
    } catch (e) { toast.error(apiError(e, "Gagal unduh PDF")); }
  };

  const dlNominal = async () => {
    try { await api.post("/auth/verify-temp-password", { password: pwd }); }
    catch (e) { toast.error(apiError(e, "Password salah")); return; }
    await runNominalDownload();
  };

  // Superadmin: langsung unduh. Admin/PIC: minta password akses sementara.
  const requestNominal = () => {
    if (isSuper) { runNominalDownload(); return; }
    setPwd(""); setPwdOpen(true);
  };

  const allDone = steps.paper && steps.ink && steps.nominal;

  const doClose = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/year/close");
      toast.success(`Tahun ditutup. ${data.paper_deleted + data.ink_deleted} mutasi dihapus.`);
      setConfirmOpen(false);
      setSteps({ paper: false, ink: false, nominal: false });
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  const Step = ({ done, children }) => (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className={`h-4 w-4 ${done ? "text-emerald-500" : "text-muted-foreground/40"}`} />
      <span className={done ? "" : "text-muted-foreground"}>{children}</span>
    </div>
  );

  return (
    <PageContainer
      testid="year-close-page"
      className="mx-auto max-w-2xl"
      pageTitle="Tutup Tahun"
      pageDescription={`Unduh laporan akhir tahun ${year}, lalu reset data untuk tahun baru.`}
    >

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-amber-500/15 text-amber-600"><CalendarX className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-lg font-bold">Langkah 1 — Unduh Laporan</h3>
            <p className="text-sm text-muted-foreground">Wajib unduh semua laporan sebelum menghapus data.</p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border p-4">
          <Step done={steps.paper && steps.ink}>PDF Laporan Mutasi Kertas & Tinta (setahun penuh)</Step>
          <Step done={steps.nominal}>PDF Laporan Stok Keseluruhan (nominal + grafik) — perlu password</Step>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" data-testid="download-mutations-pdf" disabled={busy} onClick={dlMutations}>
            <FileDown className="h-4 w-4" /> Unduh PDF Mutasi
          </Button>
          <Button variant="outline" className="gap-2" data-testid="download-nominal-pdf" onClick={requestNominal}>
            <FileDown className="h-4 w-4" /> Unduh PDF Stok Keseluruhan
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold">Langkah 2 — Reset Data Tahun</h3>
          <p className="text-sm text-muted-foreground">Menghapus SELURUH data mutasi kertas & tinta. Data user & log tetap tersimpan.</p>
        </div>
        <Button variant="destructive" className="gap-2" data-testid="close-year-button" disabled={!allDone || busy}
          onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" /> Hapus Data & Mulai Tahun Baru
        </Button>
        {!allDone && <p className="text-xs text-muted-foreground">Unduh semua laporan terlebih dahulu untuk mengaktifkan tombol ini.</p>}
      </Card>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent data-testid="year-pdf-password-dialog">
          <DialogHeader><DialogTitle>Konfirmasi Password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Masukkan password akses sementara untuk laporan bernominal.</p>
          <div className="space-y-1.5"><Label>Password</Label>
            <Input type="password" value={pwd} data-testid="year-pdf-password-input" autoFocus onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && dlNominal()} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>Batal</Button>
            <Button data-testid="year-pdf-confirm" onClick={dlNominal}>Unduh</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="year-close-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Yakin ingin menghapus seluruh data mutasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh data mutasi & stok kertas dan tinta akan dihapus permanen dan tahun baru dimulai. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="confirm-year-close" onClick={doClose}>
              Ya, Hapus & Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default function YearClose() {
  return <SectionGate title="Tutup Tahun (Reset Data)"><Inner /></SectionGate>;
}
