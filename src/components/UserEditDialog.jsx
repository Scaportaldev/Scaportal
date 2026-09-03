import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, UserCog } from "lucide-react";

import api from "@/lib/api";
import { apiError } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/**
 * UserEditDialog — kelola kredensial & identitas user (khusus Superadmin).
 * Tab Identitas: nama, username, email (opsional), telepon (opsional), role.
 * Tab Password: set password baru tanpa perlu password lama.
 */
export default function UserEditDialog({ user, currentUserId, onOpenChange, onSaved }) {
  const open = !!user;
  const isSelf = user?.id === currentUserId;

  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "", role: "admin" });
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "admin",
    });
    setPwd({ next: "", confirm: "" });
  }, [user]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const saveIdentity = async () => {
    if (!form.name.trim()) { toast.error("Nama wajib diisi."); return; }
    if (!form.username.trim()) { toast.error("Username wajib diisi."); return; }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      if (!isSelf) payload.role = form.role;
      await api.patch(`/users/${user.id}`, payload);
      toast.success(`Data user ${form.name.trim()} diperbarui.`);
      onOpenChange(false);
      onSaved?.();
    } catch (e) { toast.error(apiError(e, "Gagal menyimpan data user")); }
    finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (pwd.next.length < 4) { toast.error("Password minimal 4 karakter."); return; }
    if (pwd.next !== pwd.confirm) { toast.error("Konfirmasi password tidak sama."); return; }
    setBusy(true);
    try {
      const { data } = await api.patch(`/users/${user.id}/password`, { new_password: pwd.next });
      toast.success(
        data.self
          ? "Password akun Anda diperbarui. Pakai password baru saat login berikutnya."
          : `Password ${user.name} diperbarui.`,
      );
      setPwd({ next: "", confirm: "" });
      onOpenChange(false);
      onSaved?.();
    } catch (e) { toast.error(apiError(e, "Gagal mengubah password")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg" data-testid="user-edit-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Kelola Kredensial User</DialogTitle>
          <DialogDescription>
            Ubah identitas, hak akses, dan password login user.
            {isSelf && " Ini akun Anda sendiri — role tidak bisa diubah agar akses tidak terkunci."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
          <Avatar className="h-11 w-11 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {initials(form.name || user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-semibold">{form.name || user?.name}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">@{form.username || user?.username}</span>
              <Badge variant={form.role === "superadmin" ? "default" : "outline"} className="gap-1 text-[10px]">
                {form.role === "superadmin" && <ShieldCheck className="h-3 w-3" />}
                {form.role === "superadmin" ? "Superadmin" : "Admin/PIC"}
              </Badge>
              {isSelf && <Badge variant="secondary" className="text-[10px]">Akun Anda</Badge>}
            </div>
          </div>
        </div>

        <Tabs defaultValue="identitas">
          <TabsList className="w-full">
            <TabsTrigger value="identitas" className="flex-1" data-testid="useredit-tab-identity">Identitas</TabsTrigger>
            <TabsTrigger value="password" className="flex-1" data-testid="useredit-tab-password">Password</TabsTrigger>
          </TabsList>

          <TabsContent value="identitas" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Nama Lengkap</Label>
              <Input value={form.name} data-testid="useredit-name" onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={form.username} data-testid="useredit-username" onChange={(e) => set("username", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} disabled={isSelf} onValueChange={(v) => set("role", v)}>
                  <SelectTrigger data-testid="useredit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin/PIC</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground">(opsional)</span></Label>
              <Input type="email" value={form.email} placeholder="nama@email.com" data-testid="useredit-email"
                onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>No. Telepon <span className="text-muted-foreground">(opsional)</span></Label>
              <Input value={form.phone} placeholder="08xxxxxxxxxx" data-testid="useredit-phone"
                onChange={(e) => set("phone", e.target.value)} />
            </div>
            <DialogFooter className="pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button onClick={saveIdentity} disabled={busy} data-testid="useredit-save-identity">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Perubahan
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="password" className="space-y-3 pt-3">
            <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
              Sebagai Superadmin Anda bisa menetapkan password baru tanpa password lama —
              termasuk untuk akun Anda sendiri.
            </p>
            <div className="space-y-1.5">
              <Label>Password Baru</Label>
              <Input type="password" value={pwd.next} placeholder="Minimal 4 karakter" data-testid="newpwd-input"
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ulangi Password Baru</Label>
              <Input type="password" value={pwd.confirm} data-testid="newpwd-confirm-input"
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && savePassword()} />
            </div>
            <DialogFooter className="pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button onClick={savePassword} disabled={busy} data-testid="newpwd-submit">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Simpan Password
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
