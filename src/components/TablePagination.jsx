import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * TablePagination — pola dari dashboard starter
 * (components/ui/table/data-table-pagination.tsx), tanpa @tanstack/react-table
 * supaya tidak menambah dependensi baru.
 */
export default function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < pageCount;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={`sticky bottom-0 z-10 flex w-full shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-3 py-2.5 sm:gap-8 ${className}`}
      data-testid="table-pagination"
    >
      <div className="whitespace-nowrap text-sm text-muted-foreground">
        Menampilkan <span className="font-mono font-semibold tabular-nums text-foreground">{from}–{to}</span>{" "}
        dari <span className="font-mono font-semibold tabular-nums text-foreground">{total}</span> baris
      </div>

      <div className="flex items-center gap-3 sm:gap-6 lg:gap-8">
        <div className="hidden items-center gap-2 sm:flex">
          <p className="whitespace-nowrap text-sm font-medium">Baris / halaman</p>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[4.75rem]" data-testid="table-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="whitespace-nowrap text-sm font-medium">
          Hal. <span className="font-mono tabular-nums">{page}</span> / <span className="font-mono tabular-nums">{pageCount}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button aria-label="Halaman pertama" variant="outline" size="icon" className="hidden h-8 w-8 lg:flex"
            data-testid="table-first-page" disabled={!canPrev} onClick={() => onPageChange(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button aria-label="Halaman sebelumnya" variant="outline" size="icon" className="h-8 w-8"
            data-testid="table-prev-page" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button aria-label="Halaman berikutnya" variant="outline" size="icon" className="h-8 w-8"
            data-testid="table-next-page" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button aria-label="Halaman terakhir" variant="outline" size="icon" className="hidden h-8 w-8 lg:flex"
            data-testid="table-last-page" disabled={!canNext} onClick={() => onPageChange(pageCount)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
