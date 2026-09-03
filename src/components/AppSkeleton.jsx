import { Skeleton } from "@/components/ui/skeleton";
import Logo from "@/components/Logo";

/**
 * AppSkeleton — layar transisi saat sesi sedang diperiksa (login → dashboard)
 * atau saat halaman pertama dimuat.
 *
 * Menirukan kerangka layout asli (sidebar + header + kartu statistik + grafik)
 * sehingga perpindahan ke halaman sebenarnya terasa mulus, bukan sekadar
 * tulisan "Memuat…".
 */
export default function AppSkeleton({ label = "Menyiapkan ruang kerja Anda…" }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background" role="status" aria-label={label}>
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <Logo size={34} />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
        <div className="flex-1 space-y-6 px-3 py-4">
          {[4, 3, 1].map((count, g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="mx-2 h-2 w-24" />
              {[...Array(count)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2.5">
                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                  <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${60 + ((i * 13) % 35)}%` }} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 p-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <Skeleton className="mt-2 h-9 w-full rounded-md" />
        </div>
      </aside>

      {/* Konten */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-9 w-40 rounded-md md:block lg:w-56" />
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-4 py-6 md:px-8">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-soft lg:col-span-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-3 w-56" />
              <Skeleton className="mt-4 h-56 w-full rounded-lg" />
            </div>
            <div className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-soft">
              <Skeleton className="h-4 w-36" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-40" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">{label}</p>
        </main>
      </div>
    </div>
  );
}
