import { toast } from "sonner";
import ClosePage from "@/components/ClosePage";
import { exportKlienStokPdf, closeAllKlien } from "@/lib/klienApi";
import { invalidateKlien } from "@/lib/queryInvalidation";

/** Menu sidebar "Tutup Data Klien" — konsep sama dengan Tutup Tahun untuk Stok Klien. */
export default function KlienClose() {
  return (
    <ClosePage
      testid="klien-close-page"
      pageTitle="Tutup Stok Klien"
      pageDescription="Unduh PDF laporan stok klien sebagai arsip, lalu reset seluruh data stok klien."
      downloadLabel="Unduh PDF Stok Klien"
      downloadNote="PDF Laporan Stok Klien (semua status item)"
      onDownload={() => exportKlienStokPdf("semua")}
      deleteLabel="Hapus Semua Data Stok Klien"
      deleteNote="Menghapus SELURUH klien, PO, item, dan riwayat mutasi stok klien. Data tools lain tidak tersentuh."
      confirmTitle="Yakin ingin menghapus SEMUA data stok klien?"
      confirmDescription="Seluruh klien, PO, item, dan riwayat mutasi akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
      onDelete={async (queryClient) => {
        const data = await closeAllKlien();
        toast.success(`Data ditutup. ${data.klien_deleted} klien, ${data.po_deleted} PO, ${data.item_deleted} item, ${data.mutasi_deleted} mutasi dihapus.`);
        invalidateKlien(queryClient);
      }}
      testidPrefix="klien-close"
    />
  );
}
