import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileStack, Droplets, Package, ClipboardList, BarChart3,
  Users, CalendarX, Calculator, ListTodo, CalendarDays, Search, Moon, Sun, LogOut,
  Boxes, History, Receipt, PieChart,
} from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";

/**
 * Command palette — pola kbar dari dashboard starter
 * (components/kbar + components/search-input.tsx), diimplementasikan dengan
 * `cmdk` yang sudah tersedia di project ini.
 *
 * Buka dengan Ctrl+K / ⌘K, lalu lompat ke menu mana pun tanpa mouse.
 */

const ICONS = {
  dashboard: LayoutDashboard,
  kertas: FileStack,
  tinta: Droplets,
  lain: Package,
  laporan: ClipboardList,
  detail: BarChart3,
  log: Users,
  tahun: CalendarX,
  hpp: Calculator,
  poList: ListTodo,
  kalender: CalendarDays,
};

export function CommandPaletteTrigger({ onOpen }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
  return (
    <Button
      variant="outline"
      onClick={onOpen}
      data-testid="command-palette-trigger"
      className="relative hidden h-9 w-40 justify-start gap-2 pr-14 font-normal text-muted-foreground lg:w-56 md:inline-flex"
    >
      <Search className="h-4 w-4" />
      Cari menu…
      <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">{isMac ? "⌘" : "Ctrl"} K</Kbd>
    </Button>
  );
}

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { perms, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const groups = useMemo(() => {
    const stok = [
      { to: "/stok", label: "Dashboard", icon: ICONS.dashboard, show: perms.canStokDashboard },
      { to: "/stok/kertas", label: "Mutasi Kertas", icon: ICONS.kertas, show: perms.canStokMutations },
      { to: "/stok/tinta", label: "Mutasi Tinta", icon: ICONS.tinta, show: perms.canStokMutations },
      { to: "/stok/lainnya", label: "Mutasi Lain", icon: ICONS.lain, show: perms.canStokMutations },
      { to: "/stok/laporan-stok", label: "Laporan Stok", icon: ICONS.laporan, show: perms.canStokReport },
      { to: "/stok/laporan-detail", label: "Laporan Detail", icon: ICONS.detail, show: perms.canStokDetail },
      { to: "/stok/log-user", label: "Log & User", icon: ICONS.log, show: perms.canStokLogs },
      { to: "/stok/tutup-tahun", label: "Tutup Tahun", icon: ICONS.tahun, show: perms.canStokYearClose },
    ].filter((i) => i.show);

    const po = [
      { to: "/po", label: "Dashboard PO", icon: ICONS.dashboard, show: true },
      { to: "/po/pos", label: "Daftar PO", icon: ICONS.poList, show: true },
      { to: "/po/pos/new", label: "Buat PO Baru", icon: ListTodo, show: true },
      { to: "/po/kalender", label: "Kalender Jadwal", icon: ICONS.kalender, show: true },
    ];

    const hpp = perms.canHpp
      ? [{ to: "/hpp", label: "Kalkulator HPP", icon: ICONS.hpp, show: true }]
      : [];

    const klien = perms.canStokKlien
      ? [
          { to: "/stok-klien", label: "Dashboard Stok Klien", icon: Boxes },
          { to: "/stok-klien/riwayat", label: "Riwayat Mutasi Klien", icon: History },
        ]
      : [];

    const tempo = perms.canTempo
      ? [
          { to: "/tempo", label: "Daftar Invoice", icon: Receipt },
          { to: "/tempo/laporan", label: "Laporan Jatuh Tempo", icon: PieChart },
        ]
      : [];

    return [
      { heading: "Laporan Stok SCA", items: stok },
      { heading: "Tracking PO", items: po },
      ...(klien.length ? [{ heading: "Stok Klien", items: klien }] : []),
      ...(tempo.length ? [{ heading: "Jatuh Tempo Klien", items: tempo }] : []),
      ...(hpp.length ? [{ heading: "Kalkulator", items: hpp }] : []),
    ];
  }, [perms]);

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Cari menu, halaman, atau aksi…" data-testid="command-palette-input" />
      <CommandList>
        <CommandEmpty>Tidak ada hasil.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g.heading} heading={g.heading}>
            {g.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${g.heading} ${item.label}`}
                onSelect={() => go(item.to)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Aksi Cepat">
          <CommandItem
            value="ganti tema terang gelap"
            onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); onOpenChange(false); }}
          >
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Ganti Tema {theme === "dark" ? "Terang" : "Gelap"}
          </CommandItem>
          <CommandItem
            value="keluar logout"
            onSelect={async () => { onOpenChange(false); await logout("manual"); navigate("/login"); }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Keluar
            <CommandShortcut>Logout</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Hook shortcut Ctrl+K / ⌘K. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
