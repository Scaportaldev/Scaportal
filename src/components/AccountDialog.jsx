import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, KeyRound, Loader2 } from "lucide-react";

import api from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/**
 * AccountDialog — pengaturan akun sendiri (semua role).
 * Tab Profil: nama, email (opsional), telepon (opsional).
 * Tab Keamanan: ganti password dengan verifikasi password lama.
 */
export default function AccountDialog({ open, onOpenChange }) {
  const { user, setUser } = useAuth();
  const isSuper = user?.role === "superadmin";

  const [profile, setProfile] = useState({ name: "", email: "", phone: "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPwd({ current: "", next: "", confirm: "" });
    setProfile({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "" });
    api.get("/auth/me")
      .then((r) => setProfile({ name: r.data.name || "", email: r.data.email || "", phone: r.data.phone || "" }))
      .catch(() => {});
  }, [open, user]);

  const saveProfile = async () => {
    if (!profile.name.trim()) { toast.error("Nama tidak boleh kosong."); return; }
    setBusy(true);
    try {
      const { data } = await api.patch("/auth/me", {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
      });
      setUser((prev) => ({ ...prev, ...data.user }));
      toast.success("Profil akun diperbarui.");
      onOpenChange(false);
    } catch (e) { toast.error(apiError(e, "Gagal menyimpan profil")); }
    finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (!pwd.current) { toast.error("Password lama wajib diisi."); return; }
    if (pwd.next.length < 4) { toast.error("Password baru minimal 4 karakter."); return; }
    if (pwd.next !== pwd.confirm) { toast.error("Konfirmasi password tidak sama."); return; }
    setBusy(true);
    try {
      await api.patch("/auth/me", { current_password: pwd.current, new_password: pwd.next });
      toast.success("Password akun diperbarui. Pakai password baru saat login berikutnya.");
      setPwd({ current: "", next: "", confirm: "" });
      onOpenChange(false);
    } catch (e) { toast.error(apiError(e, "Gagal mengubah password")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="account-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Akun Saya</DialogTitle>
          <DialogDescription>Kelola identitas akun dan password login Anda.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
          <Avatar className="h-11 w-11 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {initials(profile.name || user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-semibold">{profile.name || user?.name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">@{user?.username}</span>
              <Badge variant={isSuper ? "default" : "outline"} className="text-[10px]">
                {isSuper ? "Superadmin" : "Admin/PIC"}
              </Badge>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profil">
          <TabsList className="w-full">
            <TabsTrigger value="profil" className="flex-1" data-testid="account-tab-profile">Profil</TabsTrigger>
            <TabsTrigger value="keamanan" className="flex-1" data-testid="account-tab-security">Keamanan</TabsTrigger>
          </TabsList>

          <TabsContent value="profil" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Nama Lengkap</Label>
              <Input value={profile.name} data-testid="account-name"
                onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={user?.username || ""} disabled readOnly data-testid="account-username" />
              <p className="text-xs text-muted-foreground">Username hanya bisa diubah Superadmin dari menu Log &amp; User.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground">(opsional)</span></Label>
              <Input type="email" value={profile.email} placeholder="nama@email.com" data-testid="account-email"
                onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>No. Telepon <span className="text-muted-foreground">(opsional)</span></Label>
              <Input value={profile.phone} placeholder="08xxxxxxxxxx" data-testid="account-phone"
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <DialogFooter className="pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
              <Button onClick={saveProfile} disabled={busy} data-testid="account-save-profile">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Profil
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="keamanan" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Password Lama</Label>
              <Input type="password" value={pwd.current} data-testid="account-current-password"
                onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password Baru</Label>
              <Input type="password" value={pwd.next} placeholder="Minimal 4 karakter" data-testid="account-new-password"
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ulangi Password Baru</Label>
              <Input type="password" value={pwd.confirm} data-testid="account-confirm-password"
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && savePassword()} />
            </div>
            <DialogFooter className="pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
              <Button onClick={savePassword} disabled={busy} data-testid="account-save-password">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Ganti Password
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
