import { useState } from "react";
import { Download, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge, DueBadge } from "@/components/tempo/StatusBadge";
import { apiError } from "@/context/AuthContext";
import { formatRp } from "@/lib/format";
import { formatDateLong, formatDateShort } from "@/lib/tempoFormat";
import { exportInvoiceDetailPdf } from "@/lib/tempoApi";

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default function InvoiceDetail({ open, onOpenChange, invoice, onEdit, onToggleStatus, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  if (!invoice) return null;

  const total = Number(invoice.total_amount) || 0;
  const paid = Number(invoice.paid_amount) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const installments = [...(invoice.installments || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const doDownload = async () => {
    setDownloading(true);
    try {
      await exportInvoiceDetailPdf(invoice);
      toast.success("PDF invoice diunduh");
    } catch (e) {
      toast.error(apiError(e, "Gagal membuat PDF"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl" data-testid="invoice-detail-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{invoice.client_name}</DialogTitle>
          <DialogDescription>Detail invoice, jatuh tempo, dan riwayat pembayaran.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={invoice.status} />
          <DueBadge dueDate={invoice.due_date} status={invoice.status} />
          <span className="rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
            {invoice.top}
          </span>
        </div>

        <Card className="rounded-2xl bg-secondary/50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Nominal Total</div>
              <div className="font-display text-2xl font-extrabold [font-variant-numeric:tabular-nums]">{formatRp(total)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Sisa Tagihan</div>
              <div data-testid="detail-remaining"
                className={`font-display text-lg font-bold [font-variant-numeric:tabular-nums] ${
                  Number(invoice.remaining_amount) > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                {formatRp(invoice.remaining_amount)}
              </div>
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-2" />
          <div className="mt-1 text-xs text-muted-foreground">Terbayar {formatRp(paid)} ({pct}%)</div>
        </Card>

        <div className="mt-1">
          <Row label="No. Invoice" value={invoice.invoice_number || "-"} />
          <Row label="Tanggal Invoice" value={formatDateLong(invoice.invoice_date)} />
          <Row label="Jatuh Tempo" value={formatDateLong(invoice.due_date)} />
          <Row label="Tanggal PO" value={formatDateLong(invoice.po_date)} />
          <Row label="No. PO" value={invoice.po_number || "-"} />
          <Row label="No. Surat Jalan" value={invoice.delivery_note_number || "-"} />
        </div>

        {invoice.top === "Cicilan" && (
          <Card className="rounded-2xl p-4" data-testid="detail-installments">
            <h3 className="mb-2 font-display text-sm font-bold">Riwayat Cicilan</h3>
            {installments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran cicilan.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cicilan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((c) => (
                    <TableRow key={c.id || c.sequence}>
                      <TableCell>#{c.sequence}</TableCell>
                      <TableCell>{formatDateShort(c.date)}</TableCell>
                      <TableCell className="text-right font-medium [font-variant-numeric:tabular-nums]">
                        {formatRp(c.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" className="rounded-full" data-testid="detail-toggle-status"
            onClick={() => onToggleStatus(invoice)}>
            <Power className="mr-1.5 h-4 w-4" /> Tandai {invoice.status === "lunas" ? "Belum Lunas" : "Lunas"}
          </Button>
          <Button variant="secondary" className="rounded-full" data-testid="detail-edit-btn"
            onClick={() => { onOpenChange(false); onEdit(invoice); }}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
          <Button className="rounded-full" data-testid="detail-export-pdf" disabled={downloading} onClick={doDownload}>
            <Download className="mr-1.5 h-4 w-4" /> {downloading ? "Menyiapkan..." : "Download PDF"}
          </Button>
          <Button variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10"
            data-testid="detail-delete-btn" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Hapus Invoice
          </Button>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent className="rounded-2xl" data-testid="delete-invoice-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Hapus Invoice Ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Invoice <b>{invoice.client_name}</b>
                {invoice.invoice_number ? ` (${invoice.invoice_number})` : ""} akan dihapus permanen.
                Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-full" data-testid="delete-invoice-cancel">Batal</AlertDialogCancel>
              <AlertDialogAction data-testid="confirm-delete-invoice"
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { setConfirmDelete(false); onDelete(invoice); }}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
