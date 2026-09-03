import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader untuk tabel (pola "table skeleton" 21st.dev).
 * Tinggi baris mengikuti tinggi baris tabel asli (h-10 header, h-9 baris)
 * supaya tidak terjadi lompatan layout saat data selesai dimuat.
 */
export default function TableSkeleton({ columns = 5, rows = 5, className = "" }) {
  return (
    <div className={`w-full ${className}`} data-testid="table-skeleton">
      <div className="flex h-10 items-center gap-3 border-b border-border bg-muted/40 px-2">
        {[...Array(columns)].map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex h-[42px] items-center gap-3 border-b border-border/60 px-2">
          {[...Array(columns)].map((_, c) => (
            <Skeleton
              key={c}
              className="h-3 flex-1"
              style={{ opacity: 1 - r * 0.12, maxWidth: c === 0 ? "22%" : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
