import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
  return (
    <div role="status" aria-label="Memuat halaman" className="flex flex-1 flex-col gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/**
 * PageContainer — pola dari dashboard starter (components/layout/page-container.tsx).
 *
 * Menyatukan pola header halaman (judul, deskripsi, aksi di kanan), state
 * loading (skeleton), dan fallback bila user tidak punya akses — sehingga
 * setiap halaman tidak lagi menulis markup header-nya sendiri.
 */
export default function PageContainer({
  children,
  isLoading = false,
  access = true,
  accessFallback,
  pageTitle,
  pageDescription,
  pageHeaderAction,
  className = "",
  testid,
  /**
   * fillHeight — halaman tabel full-height (Mutasi, Log & User).
   * Konten mengisi sisa tinggi viewport (flex-1 + min-h-0) sehingga Card tabel
   * stretch dinamis & pagination menempel di dasar Card tanpa ruang kosong,
   * di semua ukuran layar (13" s/d QHD 27"/ultrawide). Aktif di ≥md;
   * di mobile tetap scroll halaman normal.
   */
  fillHeight = false,
}) {
  if (!access) {
    return (
      <div role="status" className="flex flex-1 items-center justify-center py-20">
        {accessFallback ?? (
          <div className="text-center text-lg text-muted-foreground">
            Anda tidak memiliki akses ke halaman ini.
          </div>
        )}
      </div>
    );
  }

  const hasHeader = pageTitle || pageHeaderAction;

  return (
    <div
      className={`flex flex-1 flex-col ${fillHeight ? "md:min-h-0" : ""} ${className}`}
      data-testid={testid}
    >
      {isLoading ? (
        <PageSkeleton />
      ) : (
        <>
          {hasHeader && (
            <div className="mb-6 flex shrink-0 flex-wrap items-start justify-between gap-3">
              <Heading title={pageTitle ?? ""} description={pageDescription} />
              {pageHeaderAction && <div className="flex shrink-0 items-center gap-2">{pageHeaderAction}</div>}
            </div>
          )}
          <div
            className={
              fillHeight
                ? "space-y-6 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-6 md:space-y-0"
                : "space-y-6"
            }
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
