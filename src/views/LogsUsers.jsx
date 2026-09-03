import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Power, Trash2, KeyRound, ShieldCheck, Inbox, UserCog, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import { formatDateTimeID } from "@/lib/format";
import SectionGate from "@/components/SectionGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import PageContainer from "@/components/layout/PageContainer";
import TablePagination from "@/components/TablePagination";
import UserEditDialog from "@/components/UserEditDialog";
import PermissionToggles from "@/components/PermissionToggles";
import { normalizePermissions, permissionLabels } from "@/lib/permissions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

function Inner() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";
  const [regOpen, setRegOpen] = useState(false);
  const EMPTY_REG = { name: "", username: "", password: "", email: "", phone: "", permissions: normalizePermissions(null) };
  const [reg, setReg] = useState(EMPTY_REG);
  const [tempPwd, setTempPwd] = useState("");
  const [delUser, setDelUser] = useState(null);
  // Kelola kredensial user (khusus Superadmin, boleh untuk akun sendiri)
  const [editUser, setEditUser] = useState(null);
  const [editTab, setEditTab] = useState("identitas");
  const openEdit = (u, tab = "identitas") => { setEditTab(tab); setEditUser(u); };

  // Pagination lokal per tabel (log aktivitas, audit mutasi, daftar user)
  const [actPage, setActPage] = useState(1);
  const [actSize, setActSize] = useState(25);
  const [audPage, setAudPage] = useState(1);
  const [audSize, setAudSize] = useState(25);
  const [usrPage, setUsrPage] = useState(1);
  const [usrSize, setUsrSize] = useState(25);

  // Cache react-query: tampil instan dari cache, refresh otomatis di background.
  const queryClient = useQueryClient();
  const { data: activity = [] } = useQuery({
    queryKey: ["logs", "activity"],
    queryFn: async () => (await api.get("/logs/activity")).data,
    refetchOnMount: "always",
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["logs", "audit"],
    queryFn: async () => (await api.get("/logs/audit")).data,
    refetchOnMount: "always",
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    enabled: isSuper,
    refetchOnMount: "always",
  });

  const paginate = (rows, page, size) => rows.slice((page - 1) * size, page * size);
  const activityRows = paginate(activity, actPage, actSize);
  const auditRows = paginate(audit, audPage, audSize);
  const userRows = paginate(users, usrPage, usrSize);

  useEffect(() => { setActPage(1); }, [actSize]);
  useEffect(() => { setAudPage(1); }, [audSize]);
  useEffect(() => { setUsrPage(1); }, [usrSize]);

  // Dipanggil setelah registrasi/toggle/hapus/edit user — invalidasi cache.
  const loadLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["logs"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }, [queryClient]);

  const doRegister = async () => {
    if (!reg.name || !reg.username || !reg.password) { toast.error("Lengkapi semua field."); return; }
    try {
      await api.post("/users", { ...reg, role: "admin" });
      toast.success("User berhasil didaftarkan.");
      setRegOpen(false); setReg(EMPTY_REG);
      loadLogs();
    } catch (e) { toast.error(apiError(e)); }
  };

  const toggleUser = async (u) => {
    try { await api.patch(`/users/${u.id}/toggle`); toast.success("Status user diperbarui."); loadLogs(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const doDeleteUser = async () => {
    try { await api.delete(`/users/${delUser.id}`); toast.success("User dihapus."); setDelUser(null); loadLogs(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const changeTemp = async () => {
    if (tempPwd.length < 4) { toast.error("Password minimal 4 karakter."); return; }
    try { await api.post("/settings/temp-password", { new_password: tempPwd }); toast.success("Password akses sementara diperbarui."); setTempPwd(""); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <PageContainer
      fillHeight
      testid="logs-users-page"
      pageTitle={isSuper ? "Log & Manajemen User" : "Log Aktivitas"}
      pageDescription={isSuper ? "Aktivitas login, audit mutasi, dan pengelolaan user & hak akses." : "Aktivitas login dan audit mutasi."}
    >

      <Tabs defaultValue="activity" className="md:flex md:min-h-0 md:flex-1 md:flex-col">
        <TabsList className="flex-wrap md:shrink-0">
          <TabsTrigger value="activity" data-testid="tab-activity">Log Aktivitas</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Mutasi</TabsTrigger>
          {isSuper && <TabsTrigger value="users" data-testid="tab-users">Manajemen User</TabsTrigger>}
        </TabsList>

        <TabsContent value="activity" className="md:min-h-0 md:flex-1 md:flex-col md:data-[state=active]:flex">
          <Card className="flex flex-col overflow-hidden md:min-h-0 md:flex-1">
            <div className="max-h-[60vh] overflow-auto md:max-h-none md:min-h-0 md:flex-1">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow><TableHead>Nama</TableHead><TableHead>Username</TableHead>
                  <TableHead>Waktu Login</TableHead><TableHead>Waktu Logout</TableHead><TableHead>Keterangan</TableHead></TableRow>
              </TableHeader>
              <TableBody data-testid="activity-log-table">
                {activityRows.length ? activityRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.username}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTimeID(a.login_time)}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.logout_time ? formatDateTimeID(a.logout_time) : <Badge variant="outline">Aktif</Badge>}</TableCell>
                    <TableCell>{a.logout_type || "-"}</TableCell>
                  </TableRow>
                )) : <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-6"><Empty className="py-3"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>Belum ada log aktivitas</EmptyTitle><EmptyDescription>Log tercatat otomatis saat ada aktivitas pengguna.</EmptyDescription></EmptyHeader></Empty></TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
            {activity.length > 0 && (
              <TablePagination
                page={actPage}
                pageSize={actSize}
                total={activity.length}
                onPageChange={setActPage}
                onPageSizeChange={setActSize}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="md:min-h-0 md:flex-1 md:flex-col md:data-[state=active]:flex">
          <Card className="flex flex-col overflow-hidden md:min-h-0 md:flex-1">
            <div className="max-h-[60vh] overflow-auto md:max-h-none md:min-h-0 md:flex-1">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow><TableHead>Waktu</TableHead><TableHead>User</TableHead><TableHead>Aksi</TableHead>
                  <TableHead>Tipe</TableHead><TableHead>Detail</TableHead></TableRow>
              </TableHeader>
              <TableBody data-testid="audit-log-table">
                {auditRows.length ? auditRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTimeID(a.timestamp)}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.action}</Badge></TableCell>
                    <TableCell className="capitalize">{a.mutation_type === "paper" ? "Kertas" : a.mutation_type === "ink" ? "Tinta" : a.mutation_type}</TableCell>
                    <TableCell className="max-w-xs">
                      <details>
                        <summary className="cursor-pointer text-xs text-primary">Lihat sebelum/sesudah</summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-secondary p-2 text-[10px]">{JSON.stringify({ sebelum: a.before, sesudah: a.after }, null, 1)}</pre>
                      </details>
                    </TableCell>
                  </TableRow>
                )) : <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-6"><Empty className="py-3"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>Belum ada log audit</EmptyTitle><EmptyDescription>Log audit tercatat saat ada perubahan data.</EmptyDescription></EmptyHeader></Empty></TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
            {audit.length > 0 && (
              <TablePagination
                page={audPage}
                pageSize={audSize}
                total={audit.length}
                onPageChange={setAudPage}
                onPageSizeChange={setAudSize}
              />
            )}
          </Card>
        </TabsContent>

        {isSuper && (
          <TabsContent value="users" className="space-y-5 md:min-h-0 md:flex-1 md:flex-col md:gap-5 md:space-y-0 md:data-[state=active]:flex">
            <Card className="p-5 md:flex md:min-h-0 md:flex-1 md:flex-col">
              <div className="mb-3 flex items-center justify-between md:shrink-0">
                <h3 className="font-display text-lg font-bold">Daftar User</h3>
                <Dialog open={regOpen} onOpenChange={setRegOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="register-user-button"><UserPlus className="h-4 w-4" /> Registrasi User</Button>
                  </DialogTrigger>
                  <DialogContent data-testid="register-dialog" className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader><DialogTitle>Registrasi User Baru</DialogTitle></DialogHeader>
                    <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                      <div className="space-y-1.5"><Label>Nama</Label><Input value={reg.name} data-testid="reg-name" onChange={(e) => setReg({ ...reg, name: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Username</Label><Input value={reg.username} data-testid="reg-username" onChange={(e) => setReg({ ...reg, username: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={reg.password} data-testid="reg-password" onChange={(e) => setReg({ ...reg, password: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Email <span className="text-muted-foreground">(opsional)</span></Label><Input type="email" placeholder="nama@email.com" value={reg.email} data-testid="reg-email" onChange={(e) => setReg({ ...reg, email: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>No. Telepon <span className="text-muted-foreground">(opsional)</span></Label><Input placeholder="08xxxxxxxxxx" value={reg.phone} data-testid="reg-phone" onChange={(e) => setReg({ ...reg, phone: e.target.value })} /></div>
                      <div className="space-y-1.5 pt-1">
                        <Label className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Hak Akses Tools</Label>
                        <p className="text-xs text-muted-foreground">Nyalakan tools yang boleh dibuka user ini. Bisa diubah kapan saja.</p>
                        <PermissionToggles value={reg.permissions} onChange={(p) => setReg({ ...reg, permissions: p })} testidPrefix="reg-perm" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRegOpen(false)}>Batal</Button>
                      <Button data-testid="reg-submit" onClick={doRegister}>Daftarkan</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="max-h-[55vh] overflow-auto md:max-h-none md:min-h-0 md:flex-1">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow><TableHead>Nama</TableHead><TableHead>Username</TableHead><TableHead>Hak Akses</TableHead>
                      <TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
                  </TableHeader>
                  <TableBody data-testid="users-table">
                    {userRows.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.username}</TableCell>
                        <TableCell data-testid={`perms-${u.id}`}>
                          {u.role === "superadmin" ? (
                            <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Superadmin · semua tools</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {permissionLabels(u.permissions).length
                                ? permissionLabels(u.permissions).map((l) => <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>)
                                : <Badge variant="secondary" className="text-[10px] text-muted-foreground">Belum ada akses</Badge>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{u.active !== false ? <Badge className="bg-emerald-500/15 text-emerald-600">Aktif</Badge> : <Badge variant="destructive">Nonaktif</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Atur hak akses" data-testid={`perm-${u.id}`} onClick={() => openEdit(u, "akses")}><SlidersHorizontal className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Kelola user" data-testid={`changepwd-${u.id}`} onClick={() => openEdit(u, "identitas")}><UserCog className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" disabled={u.id === user.id} data-testid={`toggle-${u.id}`} onClick={() => toggleUser(u)}><Power className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" disabled={u.id === user.id} data-testid={`deluser-${u.id}`} onClick={() => setDelUser(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {users.length > usrSize && (
                <div className="-mx-5 -mb-5 mt-3 md:shrink-0">
                  <TablePagination
                    page={usrPage}
                    pageSize={usrSize}
                    total={users.length}
                    onPageChange={setUsrPage}
                    onPageSizeChange={setUsrSize}
                    pageSizeOptions={[10, 25, 50]}
                  />
                </div>
              )}
            </Card>

            <Card className="p-5 md:shrink-0">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h3 className="font-display text-lg font-bold">Ubah Password Akses Sementara</h3>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">Lapisan tambahan: user non-superadmin yang sudah diberi akses Laporan Detail / Log / Tutup Tahun tetap harus memasukkan password ini saat membuka section tersebut. Hanya Superadmin yang bisa mengubahnya.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Password Baru</Label>
                  <Input type="password" className="w-64" value={tempPwd} data-testid="temp-password-input" onChange={(e) => setTempPwd(e.target.value)} />
                </div>
                <Button data-testid="change-temp-password-button" onClick={changeTemp}>Simpan Password</Button>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <UserEditDialog
        user={editUser}
        defaultTab={editTab}
        currentUserId={user?.id}
        onOpenChange={(o) => !o && setEditUser(null)}
        onSaved={loadLogs}
      />

      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus user {delUser?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-deluser" onClick={doDeleteUser}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default function LogsUsers() {
  return <SectionGate title="Log & Manajemen User"><Inner /></SectionGate>;
}
