import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, LogOut, Moon, Sun, ShieldCheck, Users, Globe, UserCog, Settings2 } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AccountDialog from "@/components/AccountDialog";

/**
 * NavUser — pola nav-user.tsx dari shadcn dashboard starter.
 *
 * Satu kartu user di footer sidebar; semua aksi (akun, tema, bahasa, keluar)
 * ada di dalam dropdown supaya tidak ada tombol Keluar ganda.
 */

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export default function NavUser({ user, isSuper, lang, setLang, onLogout }) {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const dark = theme === "dark";
  const subtitle = user?.email || `@${user?.username || ""}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="nav-user-trigger"
            className="flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors duration-200 ease-out hover:border-border hover:bg-secondary data-[state=open]:border-border data-[state=open]:bg-secondary"
          >
            <Avatar className="h-9 w-9 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-semibold">{user?.name}</span>
              <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-60" data-testid="nav-user-menu">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                  {initials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-semibold">{user?.name}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="opacity-100">
            {isSuper ? <ShieldCheck className="mr-2 h-4 w-4 text-primary" /> : <Users className="mr-2 h-4 w-4" />}
            <span className="text-xs font-medium">{isSuper ? "Superadmin" : "Admin / PIC"}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem data-testid="nav-user-account" onClick={() => setAccountOpen(true)}>
              <UserCog className="mr-2 h-4 w-4" /> Akun Saya
            </DropdownMenuItem>
            {isSuper && (
              <DropdownMenuItem data-testid="nav-user-manage" onClick={() => navigate("/stok/log-user")}>
                <Settings2 className="mr-2 h-4 w-4" /> Manajemen User
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem data-testid="nav-user-theme" onClick={() => setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              Tema {dark ? "Terang" : "Gelap"}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="nav-user-lang" onClick={() => setLang(lang === "id" ? "en" : "id")}>
              <Globe className="mr-2 h-4 w-4" /> Bahasa: {lang === "id" ? "Indonesia" : "English"}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="nav-user-logout"
            className="text-destructive focus:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}
