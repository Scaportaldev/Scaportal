import { useLocation } from "react-router-dom";

/**
 * useBreadcrumbs — pola dari dashboard starter (hooks/use-breadcrumbs.ts).
 * Membangun breadcrumb dari pathname, dengan label Bahasa Indonesia.
 */

const ROUTE_LABELS = {
  stok: "Laporan Stok",
  kertas: "Mutasi Kertas",
  tinta: "Mutasi Tinta",
  lainnya: "Mutasi Lain",
  "laporan-stok": "Laporan Stok",
  "laporan-detail": "Laporan Detail",
  "log-user": "Log & User",
  "tutup-tahun": "Tutup Tahun",
  po: "Tracking PO",
  pos: "Daftar PO",
  new: "PO Baru",
  edit: "Ubah PO",
  kalender: "Kalender Jadwal",
  hpp: "Kalkulator HPP",
  "stok-klien": "Stok Klien",
  riwayat: "Riwayat Mutasi",
  tempo: "Jatuh Tempo Klien",
  laporan: "Laporan",
};

const isId = (seg) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^[0-9a-f]{16,}$/i.test(seg);

export function useBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  const items = [];
  let path = "";
  segments.forEach((seg) => {
    path += `/${seg}`;
    if (isId(seg)) {
      items.push({ title: "Detail", link: path });
      return;
    }
    items.push({
      title: ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      link: path,
    });
  });

  return items;
}

export default useBreadcrumbs;
