import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/index.css";
import "@/App.css";

export const metadata = {
  title: "LAPORAN STOK SCA",
  description: "LAPORAN STOK SCA — Mutasi & Laporan Stok Kertas & Tinta",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <noscript>Anda perlu mengaktifkan JavaScript untuk menjalankan aplikasi ini.</noscript>
        {children}
      </body>
    </html>
  );
}
