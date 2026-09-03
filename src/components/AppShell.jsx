import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileStack, Droplets, Package, ClipboardList, BarChart3,
  Users, CalendarX, Menu, X, Lock, Calculator,
  ListTodo, CalendarDays, Globe, Search, Boxes, History, Receipt, PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LangContext";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import Breadcrumbs from "@/components/Breadcrumbs";
import NavUser from "@/components/NavUser";
import CommandPalette, { CommandPaletteTrigger, useCommandPalette } from "@/components/CommandPalette";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const TIMEOUT_MS = 60 * 60 * 1000;
const WARN_MS = 58 * 60 * 1000;

export default function AppShell() {
  const { user, logout, sectionUnlocked, perms } = useAuth();
  const { lang, setLang } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [warn, setWarn] = useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const warnRef = useRef(null);
  const outRef = useRef(null);

  const doLogout = useCallback(async (type) => { await logout(type); navigate("/login"); }, [logout, navigate]);

  const resetTimers = useCallback(() => {
    setWarn(false);
    clearTimeout(warnRef.current);
    clearTimeout(outRef.current);
    warnRef.current = setTimeout(() => setWarn(true), WARN_MS);
    outRef.current = setTimeout(() => {
      toast.warning("Anda telah logout otomatis karena tidak aktif.");
      doLogout("auto");
    }, TIMEOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    const handler = () => resetTimers();
    events.forEach((e) => window.addEventListener(e, handler));
    resetTimers();
    return () => { events.forEach((e) => window.removeEventListener(e, handler)); clearTimeout(warnRef.current); clearTimeout(outRef.current); };
  }, [resetTimers]);

  const isSuper = user?.role === "superadmin";

  const stokMenu = [
    { to: "/stok", label: "Dashboard", icon: LayoutDashboard, end: true, show: perms.canStokDashboard },
    { to: "/stok/kertas", label: "Mutasi Kertas", icon: FileStack, show: perms.canStokMutations },
    { to: "/stok/tinta", label: "Mutasi Tinta", icon: Droplets, show: perms.canStokMutations },
    { to: "/stok/lainnya", label: "Mutasi Lain", icon: Package, show: perms.canStokMutations },
    { to: "/stok/laporan-stok", label: "Laporan Stok", icon: ClipboardList, show: perms.canStokReport },
    { to: "/stok/laporan-detail", label: "Laporan Detail", icon: BarChart3, locked: true, show: perms.canStokDetail },
    { to: "/stok/tutup-tahun", label: "Tutup Tahun", icon: CalendarX, locked: true, show: perms.canStokYearClose },
  ].filter((m) => m.show);

  // Ditempatkan terpisah di pojok kiri bawah sidebar (di atas kartu user).
  const logUserItem = perms.canStokLogs
    ? { to: "/stok/log-user", label: "Log & User", icon: Users, locked: true }
    : null;

  const poMenu = [
    { to: "/po", label: "Dashboard PO", icon: LayoutDashboard, end: true },
    { to: "/po/pos", label: "Daftar PO", icon: ListTodo },
    { to: "/po/kalender", label: "Kalender Jadwal", icon: CalendarDays },
  ];

  const hppMenu = perms.canHpp ? [{ to: "/hpp", label: "Kalkulator HPP", icon: Calculator, end: true }] : [];

  // Tool baru: Stok Klien (Superadmin + Admin/PIC)
  const klienMenu = perms.canStokKlien
    ? [
        { to: "/stok-klien", label: "Dashboard Stok Klien", icon: Boxes, end: true },
        { to: "/stok-klien/riwayat", label: "Riwayat Mutasi Klien", icon: History },
      ]
    : [];

  // Tool baru: Jatuh Tempo Klien (Superadmin only — memuat nominal Rupiah)
  const tempoMenu = perms.canTempo
    ? [
        { to: "/tempo", label: "Daftar Invoice", icon: Receipt, end: true },
        { to: "/tempo/laporan", label: "Laporan Jatuh Tempo", icon: PieChart },
      ]
    : [];

  const NavItem = ({ item }) => (
    <NavLink to={item.to} end={item.end}
      data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-[color,background-color,box-shadow,opacity] duration-200 ease-out ${isActive
          ? "bg-primary text-primary-foreground shadow-glow"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 ease-out" />
      <span className="flex-1">{item.label}</span>
      {item.locked && !isSuper && !sectionUnlocked && (<Lock className="h-3.5 w-3.5 opacity-60" />)}
    </NavLink>
  );

  const SectionHeader = ({ label }) => (
    <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">{label}</div>
  );

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <Logo size={38} />
        <div>
          <div className="font-display text-base font-extrabold tracking-tight leading-none">SCA PORTAL</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Stok • PO • Klien</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
        <SectionHeader label="Laporan Stok SCA" />
        {stokMenu.map((item) => <NavItem key={item.to} item={item} />)}

        <SectionHeader label="Tracking PO" />
        {poMenu.map((item) => <NavItem key={item.to} item={item} />)}

        {klienMenu.length > 0 && (
          <>
            <SectionHeader label="Stok Klien" />
            {klienMenu.map((item) => <NavItem key={item.to} item={item} />)}
          </>
        )}

        {tempoMenu.length > 0 && (
          <>
            <SectionHeader label="Jatuh Tempo Klien" />
            {tempoMenu.map((item) => <NavItem key={item.to} item={item} />)}
          </>
        )}

        {hppMenu.length > 0 && (
          <>
            <SectionHeader label="Kalkulator" />
            {hppMenu.map((item) => <NavItem key={item.to} item={item} />)}
          </>
        )}
      </nav>
      <div className="border-t border-border p-3 space-y-2">
        {logUserItem && (
          <div data-testid="sidebar-footer-nav">
            <NavItem item={logUserItem} />
          </div>
        )}
        <NavUser
          user={user}
          isSuper={isSuper}
          lang={lang}
          setLang={setLang}
          onLogout={() => doLogout("manual")}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden md:flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
        {SidebarInner}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-card shadow-xl">{SidebarInner}</div>
        </div>
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/70 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" className="md:hidden" data-testid="mobile-menu-button" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <span className="hidden font-display text-sm font-semibold text-muted-foreground md:inline">Sistem Terpadu SCA</span>
            <Separator orientation="vertical" className="hidden h-4 md:block" />
            <div className="min-w-0 truncate text-sm">
              <Breadcrumbs />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CommandPaletteTrigger onOpen={() => setCmdOpen(true)} />
            <Button variant="outline" size="icon" className="md:hidden" data-testid="command-palette-trigger-mobile"
              aria-label="Cari menu" onClick={() => setCmdOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="w-[92px] h-9" data-testid="lang-toggle">
                <div className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{lang === "id" ? "ID" : "EN"}</div>
              </SelectTrigger>
              <SelectContent><SelectItem value="id">Indonesia</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
            </Select>
            <ThemeToggle />
          </div>
        </header>
        {/* flex flex-col: supaya PageContainer (flex-1) bisa mengisi sisa tinggi viewport
            secara dinamis (dibutuhkan halaman tabel full-height). Halaman lain tetap
            scroll normal karena overflow-y-auto dipertahankan. */}
        <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-8">
          {/* Fallback saat chunk halaman lazy dimuat — sidebar & header tetap terlihat */}
          <Suspense
            fallback={
              <div role="status" aria-label="Memuat halaman" className="flex flex-1 flex-col gap-4">
                <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
                <div className="mt-2 h-64 w-full animate-pulse rounded-xl bg-muted" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      <AlertDialog open={warn} onOpenChange={setWarn}>
        <AlertDialogContent data-testid="idle-warning-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Sesi akan berakhir</AlertDialogTitle>
            <AlertDialogDescription>Anda tidak aktif selama beberapa waktu. Sistem akan logout otomatis dalam ±2 menit. Klik "Tetap Login" untuk melanjutkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="idle-logout-now" onClick={() => doLogout("manual")}>Keluar Sekarang</AlertDialogCancel>
            <AlertDialogAction data-testid="idle-stay-login" onClick={() => resetTimers()}>Tetap Login</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
