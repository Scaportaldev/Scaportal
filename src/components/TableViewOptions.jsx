import { Check, ChevronsUpDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * TableViewOptions — pola dari dashboard starter
 * (components/ui/table/data-table-view-options.tsx).
 *
 * Memungkinkan user menyembunyikan / menampilkan kolom tabel.
 * `columns` = [{ id, label }], `visible` = { [id]: boolean }.
 */
export default function TableViewOptions({ columns, visible, onToggle, className = "" }) {
  const shownCount = columns.filter((c) => visible[c.id] !== false).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Atur kolom tabel"
          data-testid="table-view-options"
          className={cn("h-9 gap-1.5", className)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Kolom</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{shownCount}/{columns.length}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-0">
        <Command>
          <CommandInput placeholder="Cari kolom…" />
          <CommandList>
            <CommandEmpty>Kolom tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {columns.map((col) => {
                const isVisible = visible[col.id] !== false;
                return (
                  <CommandItem
                    key={col.id}
                    value={col.label}
                    data-testid={`table-column-${col.id}`}
                    onSelect={() => onToggle(col.id, !isVisible)}
                  >
                    <span className="truncate">{col.label}</span>
                    <Check className={cn("ml-auto h-4 w-4 shrink-0", isVisible ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
