import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import TableSkeleton from "@/components/TableSkeleton";

/**
 * MutasiTable — tabel reusable untuk semua halaman Mutasi (Kertas, Tinta, Lain,
 * Riwayat Mutasi Klien, dst.). Konfigurasi kolom dinamis, jadi tiap jenis mutasi
 * cukup mengirim daftar kolomnya sendiri.
 *
 * Responsif:
 *   - Desktop (>= md / 768px): <Table> biasa (tidak berubah dari sebelumnya).
 *   - Mobile  (<  md)        : list of cards —
 *       Header : kolom `role: "name"` (kiri) + kolom `role: "status"` (badge, kanan)
 *       Body   : grid 2 kolom "label kiri, value kanan" untuk kolom lainnya
 *       Footer : border-top tipis, tombol Edit & Hapus rata kanan (ikon + teks)
 *
 * Props
 *   columns : Array<{
 *     id            : string             — unik
 *     label         : ReactNode          — judul kolom / label field di kartu
 *     render        : (row) => ReactNode — isi sel
 *     cardRender?   : (row) => ReactNode — override isi field di kartu (default: render)
 *     role?         : "name" | "status"  — posisi khusus di header kartu
 *     align?        : "left" | "right"   — perataan sel desktop
 *     headClassName?, cellClassName? : string
 *     cardHidden?   : boolean            — sembunyikan field ini di kartu mobile
 *     desktopHidden?: boolean            — kolom hanya untuk kartu mobile (mis. badge status yang di desktop sudah ada di kolom lain)
 *     cardClassName?: string             — kelas tambahan wrapper field di kartu (mis. "col-span-2")
 *   }>
 *   data       : Array<row>
 *   rowKey     : (row, index) => string  (default row.id)
 *   rowTestId? : (row) => string
 *   actions?   : {
 *     onEdit(row), onDelete(row), canModify?(row) => boolean,
 *     editTestId?(row), deleteTestId?(row), label?: ReactNode (judul kolom, default "Aksi")
 *   }
 *   NOTE: `onDelete` HARUS membuka dialog konfirmasi di pemanggil sebelum benar-benar
 *   menghapus (semua halaman Mutasi memakai AlertDialog / ConfirmDeleteDialog).
 *   renderActions?(row, { mobile }) : ReactNode — override total isi kolom/footer aksi
 *     (dipakai halaman non-mutasi, mis. Log & User). Bila diisi, tombol Edit/Hapus default
 *     tidak dirender. Pemanggil bertanggung jawab atas tap target >= 44px di mobile.
 *   isLoading, skeletonRows
 *   empty      : { icon, title, description }
 *   scrollClassName : kelas wrapper scroll tabel desktop
 *   testid     : data-testid untuk <tbody> desktop; kartu memakai `${testid}-cards`
 */
export default function MutasiTable({
  columns = [],
  data = [],
  rowKey = (row) => row.id,
  rowTestId,
  actions,
  isLoading = false,
  skeletonRows = 5,
  empty,
  scrollClassName = "",
  testid = "mutasi-table",
  className = "",
}) {
  const cols = columns.filter(Boolean);
  const desktopCols = cols.filter((c) => !c.desktopHidden);
  const nameCol = cols.find((c) => c.role === "name");
  const statusCol = cols.find((c) => c.role === "status");
  const fieldCols = cols.filter((c) => c !== nameCol && c !== statusCol && !c.cardHidden);
  const colCount = desktopCols.length + (actions ? 1 : 0);
  const isEmpty = !isLoading && data.length === 0;

  const canModify = (row) => (actions?.canModify ? actions.canModify(row) : true);
  const editId = (row) => (actions?.editTestId ? actions.editTestId(row) : `edit-${rowKey(row)}`);
  const deleteId = (row) => (actions?.deleteTestId ? actions.deleteTestId(row) : `delete-${rowKey(row)}`);

  const emptyNode = empty ? (
    <Empty className="py-4" data-testid={`${testid}-empty`}>
      <EmptyHeader>
        {empty.icon && <EmptyMedia variant="icon">{empty.icon}</EmptyMedia>}
        {empty.title && <EmptyTitle>{empty.title}</EmptyTitle>}
        {empty.description && <EmptyDescription>{empty.description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  ) : (
    <div className="py-6 text-center text-sm text-muted-foreground">Tidak ada data.</div>
  );

  return (
    <>
      {/* ============================ DESKTOP (>= md) ============================ */}
      <div className={cn("hidden md:block", scrollClassName, className)} data-testid={`${testid}-desktop`}>
        {isLoading ? (
          <TableSkeleton columns={colCount} rows={skeletonRows} />
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {desktopCols.map((c) => (
                  <TableHead
                    key={c.id}
                    className={cn(c.align === "right" && "text-right", c.headClassName)}
                  >
                    {c.label}
                  </TableHead>
                ))}
                {actions && <TableHead className="text-right">{actions.label ?? "Aksi"}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody data-testid={testid}>
              {isEmpty && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount} className="py-6">{emptyNode}</TableCell>
                </TableRow>
              )}
              {data.map((row, idx) => {
                const key = rowKey(row, idx);
                return (
                  <TableRow key={key} className="stagger-in" data-testid={rowTestId ? rowTestId(row) : undefined}>
                    {desktopCols.map((c) => (
                      <TableCell
                        key={c.id}
                        className={cn(c.align === "right" && "text-right", c.cellClassName)}
                      >
                        {c.render(row)}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell className="text-right">
                        {actions.renderActions ? actions.renderActions(row, { mobile: false }) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon" variant="ghost" aria-label="Edit"
                            disabled={!canModify(row)}
                            data-testid={editId(row)}
                            onClick={() => actions.onEdit?.(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" aria-label="Hapus"
                            disabled={!canModify(row)}
                            data-testid={deleteId(row)}
                            onClick={() => actions.onDelete?.(row)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ============================ MOBILE (< md) ============================= */}
      <div className="flex flex-col gap-3 md:hidden" data-testid={`${testid}-cards`}>
        {isLoading && (
          [...Array(Math.min(skeletonRows, 3))].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/70 bg-card p-4 shadow-soft" data-testid="mutasi-card-skeleton">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-14 rounded" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {[...Array(6)].map((__, j) => <Skeleton key={j} className="h-3 w-full" />)}
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-border/70 pt-3">
                <Skeleton className="h-11 w-20 rounded-md" />
                <Skeleton className="h-11 w-24 rounded-md" />
              </div>
            </div>
          ))
        )}

        {isEmpty && (
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">{emptyNode}</div>
        )}

        {!isLoading && data.map((row, idx) => {
          const key = rowKey(row, idx);
          const modifiable = canModify(row);
          return (
            <article
              key={key}
              className="stagger-in rounded-xl border border-border/70 bg-card p-4 text-card-foreground shadow-soft"
              data-testid={`mutasi-card-${key}`}
            >
              {/* Header: nama item + badge status */}
              {(nameCol || statusCol) && (
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug">
                    {nameCol ? (nameCol.cardRender ?? nameCol.render)(row) : null}
                  </div>
                  {statusCol && <div className="shrink-0">{(statusCol.cardRender ?? statusCol.render)(row)}</div>}
                </header>
              )}

              {/* Body: grid 2 kolom, label kiri — value kanan */}
              {fieldCols.length > 0 && (
                <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2", (nameCol || statusCol) && "mt-3")}>
                  {fieldCols.map((c) => (
                    <div key={c.id} className={cn("flex min-w-0 items-baseline justify-between gap-2", c.cardClassName)}>
                      <dt className="shrink-0 text-xs text-muted-foreground">{c.label}</dt>
                      <dd className="min-w-0 break-words text-right text-sm font-medium tabular-nums text-foreground">
                        {(c.cardRender ?? c.render)(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* Footer: Edit & Hapus rata kanan, tap target >= 44px */}
              {actions && (
                <footer className="mt-3 flex justify-end gap-2 border-t border-border/70 pt-3">
                  {actions.renderActions ? actions.renderActions(row, { mobile: true }) : (
                  <>
                  <Button
                    variant="outline"
                    className="min-h-[44px] min-w-[44px] gap-2 px-4"
                    disabled={!modifiable}
                    data-testid={`${editId(row)}-card`}
                    onClick={() => actions.onEdit?.(row)}
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] min-w-[44px] gap-2 px-4 border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                    disabled={!modifiable}
                    data-testid={`${deleteId(row)}-card`}
                    onClick={() => actions.onDelete?.(row)}
                  >
                    <Trash2 className="h-4 w-4" /> Hapus
                  </Button>
                  </>
                  )}
                </footer>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
