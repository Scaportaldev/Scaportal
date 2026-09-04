import { toast } from "sonner";
import ClosePage from "@/components/ClosePage";
import { exportPoRekapPdf, closeAllPo } from "@/lib/poApi";
import { invalidatePo } from "@/lib/queryInvalidation";

/** Menu sidebar "Tutup PO" — konsep sama dengan Tutup Tahun untuk PO Tracker. */
export default function PoClose() {
  return (
    <ClosePage
      testid="po-close-page"
      pageTitle="Tutup PO"
      pageDescription="Unduh PDF rekap seluruh PO sebagai arsip, lalu reset data PO Tracker."
      downloadLabel="Unduh PDF Rekap PO"
      downloadNote="PDF Rekap Purchase Order (semua bulan, dikelompokkan per bulan)"
      onDownload={() => exportPoRekapPdf({})}
      deleteLabel="Hapus Semua Data PO"
      deleteNote="Menghapus SELURUH PO, log tahapan, jadwal pengiriman, dan foto bukti (R2). Data tools lain tidak tersentuh."
      confirmTitle="Yakin ingin menghapus SEMUA data PO?"
      confirmDescription="Seluruh PO, log tahapan, jadwal pengiriman, dan foto bukti akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
      onDelete={async (queryClient) => {
        const data = await closeAllPo();
        toast.success(`PO ditutup. ${data.po_deleted} PO, ${data.jadwal_deleted} jadwal, ${data.foto_deleted} foto dihapus.`);
        invalidatePo(queryClient);
      }}
      testidPrefix="po-close"
    />
  );
}
