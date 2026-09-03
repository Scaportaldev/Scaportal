import {
  Building2, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  ArrowDownToLine, ArrowUpFromLine, CircleCheck, ArchiveRestore, PackageOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtQty } from "@/lib/klienApi";
import { fmtDate } from "@/lib/format";

export function ItemStatusBadge({ status }) {
  const aktif = status === "aktif";
  return (
    <span
      data-testid="item-status-badge"
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${
        aktif
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${aktif ? "bg-emerald-500" : "bg-muted-foreground"}`} />
      {aktif ? "Aktif" : "Selesai/Ditutup"}
    </span>
  );
}

const iconBtn =
  "h-7 w-7 text-muted-foreground transition-transform duration-150 hover:-translate-y-px hover:text-foreground";

export default function ClientCard({ klien, expanded, onTogglePo, act }) {
  return (
    <Card className="overflow-hidden rounded-2xl" data-testid={`klien-card-${klien.id}`}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
          <Building2 className="h-4.5 w-4.5" />
        </div>
        <h3 className="font-display text-lg font-bold tracking-tight">{klien.nama}</h3>
        <Badge variant="outline" className="font-normal">{klien.pos.length} PO</Badge>
        <Badge variant="outline" className="font-normal">{klien.item_count ?? 0} item</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" className="rounded-full"
            onClick={() => act.addPo(klien)} data-testid={`add-po-btn-${klien.id}`}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Tambah PO
          </Button>
          <Button variant="ghost" size="icon" className={iconBtn}
            onClick={() => act.editKlien(klien)} data-testid={`edit-klien-btn-${klien.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className={`${iconBtn} hover:text-destructive`}
            onClick={() => act.deleteKlien(klien)} data-testid={`delete-klien-btn-${klien.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {klien.pos.length === 0 && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Belum ada PO untuk klien ini.</p>
      )}

      {klien.pos.map((po) => {
        const isOpen = expanded.has(po.id);
        return (
          <div key={po.id} className="border-t border-border" data-testid={`klien-po-row-${po.id}`}>
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 transition-colors duration-150 hover:bg-secondary/60"
              onClick={() => onTogglePo(po.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTogglePo(po.id); } }}
              data-testid={`klien-po-toggle-${po.id}`}
            >
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-semibold">PO No. {po.no_po}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(po.tanggal_po)}</span>
              <Badge variant="outline" className="font-normal">{po.items.length} item</Badge>
              {po.item_aktif_count > 0 && (
                <Badge className="bg-emerald-500/15 font-normal text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
                  {po.item_aktif_count} aktif
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs"
                  onClick={() => act.addItem(po, klien)} data-testid={`add-item-btn-${po.id}`}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Item
                </Button>
                <Button variant="ghost" size="icon" className={iconBtn}
                  onClick={() => act.editPo(po, klien)} data-testid={`edit-po-btn-${po.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className={`${iconBtn} hover:text-destructive`}
                  onClick={() => act.deletePo(po, klien)} data-testid={`delete-po-btn-${po.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {isOpen && (
              <div className="overflow-x-auto px-4 pb-3">
                {po.items.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <PackageOpen className="h-4 w-4" /> Belum ada item pada PO ini.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jenis Item</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Keterangan</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {po.items.map((it) => {
                        const aktif = it.status === "aktif";
                        return (
                          <TableRow key={it.id} className={aktif ? "" : "opacity-70"} data-testid={`item-row-${it.id}`}>
                            <TableCell className="whitespace-nowrap font-medium">{it.jenis_item}</TableCell>
                            <TableCell className="text-muted-foreground">{it.satuan || "-"}</TableCell>
                            <TableCell className="text-right font-semibold [font-variant-numeric:tabular-nums]"
                              data-testid={`item-stock-${it.id}`}>
                              {fmtQty(it.kuantiti)}
                            </TableCell>
                            <TableCell><ItemStatusBadge status={it.status} /></TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">{it.keterangan || "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" title="Mutasi Masuk" disabled={!aktif}
                                  className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 disabled:opacity-40 dark:text-emerald-400"
                                  onClick={() => act.mutasi(it, po, klien, "masuk")}
                                  data-testid={`mutasi-masuk-btn-${it.id}`}>
                                  <ArrowDownToLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Mutasi Keluar" disabled={!aktif}
                                  className="h-7 w-7 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 disabled:opacity-40 dark:text-rose-400"
                                  onClick={() => act.mutasi(it, po, klien, "keluar")}
                                  data-testid={`mutasi-keluar-btn-${it.id}`}>
                                  <ArrowUpFromLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className={iconBtn}
                                  title={aktif ? "Tutup Item (Selesai)" : "Aktifkan Kembali"}
                                  onClick={() => act.toggleStatus(it)}
                                  data-testid={`toggle-status-btn-${it.id}`}>
                                  {aktif ? <CircleCheck className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className={iconBtn}
                                  onClick={() => act.editItem(it, po, klien)} data-testid={`edit-item-btn-${it.id}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className={`${iconBtn} hover:text-destructive`}
                                  onClick={() => act.deleteItem(it, po)} data-testid={`delete-item-btn-${it.id}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
