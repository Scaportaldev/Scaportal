"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import App from "@/App";

export default function ClientApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data dianggap segar 30 dtk: pindah-pindah menu dalam jendela ini tidak
            // memanggil server. Setelah aksi simpan, query terkait di-invalidate
            // (lihat src/lib/queryInvalidation.js) sehingga langsung diambil ulang.
            staleTime: 30_000,
            // Kembali ke tab/jendela -> ambil ulang bila sudah stale (jaga-jaga perubahan
            // dari perangkat/user lain).
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
