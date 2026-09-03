"use client";

import dynamic from "next/dynamic";

// Aplikasi berjalan penuh di client (react-router) supaya UI/UX tetap 100% identik
// dengan versi CRA sebelumnya.
const ClientApp = dynamic(() => import("@/ClientApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
      Memuat…
    </div>
  ),
});

export default function Page() {
  return <ClientApp />;
}
