import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  UserPlus, Power, Trash2, KeyRound, ShieldCheck, Inbox, UserCog, SlidersHorizontal, Eye,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth, apiError } from "@/context/AuthContext";
import { formatDateTimeID } from "@/lib/format";
import { cn } from "@/lib/utils";
import SectionGate from "@/components/SectionGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import PageContainer from "@/components/layout/PageContainer";
import MutasiTable from "@/components/MutasiTable";
import TablePagination from "@/components/TablePagination";
import UserEditDialog from "@/components/UserEditDialog";
import PermissionToggles from "@/components/PermissionToggles";
import AuditDiffDialog, { ACTION_LABEL, TYPE_LABEL } from "@/components/AuditDiffDialog";
import { normalizePermissions, permissionLabels } from "@/lib/permissions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const activityQuery = (page, pageSize) => ({
  queryKey: ["logs", "activity", page, pageSize],
  queryFn: async () => (await api.get("/logs/activity", { params: { page, page_size: pageSize } })).data,
});
export const prefetch = (qc) => qc.prefetchQuery(activityQuery(1, 25));

// Wrapper tabel/kartu yang sama dengan halaman Mutasi:
// desktop = Card mengisi sisa tinggi (scroll internal), mobile = kartu di atas background halaman.
const TABLE_WRAP = "flex flex-col gap-3 md:gap-0 md:min-h-0 md:flex-1 md:overflow-hidden md:rounded-xl md:border md:border-border/70 md:bg-card md:text-card-foreground md:shadow-soft";
const PAGINATION_CLS = "max-md:static max-md:rounded-xl max-md:border max-md:border-border/70 max-md:shadow-soft";
const TAB_CONTENT = "md:min-h-0 md:flex-1 md:flex-col md:data-[state=active]:flex";
// Field kartu mobile dengan label di atas nilai (untuk nilai panjang seperti tanggal+jam).
const STACKED = "flex-col items-start gap-0.5 [&>dd]:text-left [&>dd]:whitespace-nowrap";

const ActiveBadge = () => <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">Aktif</Badge>;
const InactiveBadge = () => <Badge variant="destructive">Nonaktif</Badge>;
const DoneBadge = () => <Badge variant="outline">Selesai</Badge>;

const actionBadge = (a) => (
  <Badge
    variant="outline"
    className={cn("capitalize", a === "delete" && "border-rose-500/40 text-rose-600 dark:text-rose-400", a === "edit" && "border-sky-500/40 text-sky-700 dark:text-sky-300")}
  >
    {ACTION_LABEL[a] || a}
  </Badge>
);
const typeBadge = (t) => <Badge variant="secondary" className="capitalize">{TYPE_LABEL[t] || t || "-"}</Badge>;

/** Header kartu mobile: baris utama + baris sekunder abu-abu. */
const TwoLine = ({ main, sub }) => (
  <div className="min-w-0">
    <div className="truncate">{main}</div>
    {sub && <div className="truncate text-xs font-normal text-muted-foreground">{sub}</div>}
  </div>
);

function Inner() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";
  const [regOpen, setRegOpen] = useState(false);
  const EMPTY_REG = { name: "", username: "", password: "", email: "", phone: "", permissions: normalizePermissions(null) };
  const [reg, setReg] = useState(EMPTY_REG);
  const [tempPwd, setTempPwd] = useState("");
  const [delUser, setDelUser] = useState(null);
  const [auditEntry, setAuditEntry] = useState(null);
  // Kelola kredensial user (khusus Superadmin, boleh untuk akun sendiri)
  const [editUser, setEditUser] = useState(null);
  const [editTab, setEditTab] = useState("identitas");
  const openEdit = (u, tab = "identitas") => { setEditTab(tab); setEditUser(u); };

  // Pagination: log aktivitas & audit di SERVER (?page=&page_size=), daftar user lokal (kecil).
  const [actPage, setActPage] = useState(1);
  const [actSize, setActSize] = useState(25);
  const [audPage, setAudPage] = useState(1);
  const [audSize, setAudSize] = useState(25);
  const [usrPage, setUsrPage] = useState(1);
  const [usrSize, setUsrSize] = useState(25);

  // Cache react-query: tampil instan dari cache, refresh otomatis di background.
  const queryClient = useQueryClient();
  const { data: activityPage, isLoading: actLoading } = useQuery({
    ...activityQuery(actPage, actSize),
    placeholderData: keepPreviousData,
  });
  const { data: auditPage, isLoading: audLoading } = useQuery({
    queryKey: ["logs", "audit", audPage, audSize],
    queryFn: async () => (await api.get("/logs/audit", { params: { page: audPage, page_size: audSize } })).data,
    placeholderData: keepPreviousData,
  });
  const { data: users = [], isLoading: usrLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    enabled: isSuper,
  });

  const activityRows = activityPage?.items ?? [];
  const activityTotal = activityPage?.total ?? 0;
  const auditRows = auditPage?.items ?? [];
  const auditTotal = auditPage?.total ?? 0;
  const userRows = users.slice((usrPage - 1) * usrSize, usrPage * usrSize);

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

  // ---------------- Kolom: Log Aktivitas ----------------
  const activityColumns = [
    {
      id: "name", label: "Nama", role: "name", cellClassName: "font-medium",
      render: (a) => a.name,
      cardRender: (a) => <TwoLine main={a.name} sub={a.username} />,
    },
    { id: "username", label: "Username", render: (a) => a.username, cardHidden: true },
    { id: "login", label: "Waktu Login", cellClassName: "whitespace-nowrap", cardClassName: STACKED, render: (a) => formatDateTimeID(a.login_time) },
    {
      id: "logout", label: "Waktu Logout", cellClassName: "whitespace-nowrap", cardClassName: STACKED,
      render: (a) => (a.logout_time ? formatDateTimeID(a.logout_time) : <ActiveBadge />),
      cardRender: (a) => (a.logout_time ? formatDateTimeID(a.logout_time) : "-"),
    },
    { id: "ket", label: "Keterangan", cardClassName: STACKED, render: (a) => a.logout_type || "-" },
    // Badge status hanya di header kartu mobile (di desktop sudah tampil di kolom Waktu Logout).
    { id: "status", label: "Status", role: "status", desktopHidden: true, render: (a) => (a.logout_time ? <DoneBadge /> : <ActiveBadge />) },
  ];

  // ---------------- Kolom: Audit Mutasi ----------------
  const auditColumns = [
    {
      id: "waktu", label: "Waktu", role: "name", cellClassName: "whitespace-nowrap",
      render: (a) => formatDateTimeID(a.timestamp),
      cardRender: (a) => <TwoLine main={formatDateTimeID(a.timestamp)} sub={a.name} />,
    },
    { id: "user", label: "User", cellClassName: "font-medium", render: (a) => a.name, cardHidden: true },
    { id: "aksi", label: "Aksi", render: (a) => actionBadge(a.action) },
    { id: "tipe", label: "Tipe", render: (a) => typeBadge(a.mutation_type) },
  ];
  const auditActions = {
    label: "Detail",
    renderActions: (a, { mobile }) => (
      <Button
        variant={mobile ? "outline" : "ghost"}
        size={mobile ? "default" : "sm"}
        className={cn("gap-2", mobile ? "min-h-[44px] min-w-[44px] px-4" : "h-9 text-primary hover:text-primary")}
        data-testid={`audit-detail-${a.id}${mobile ? "-card" : ""}`}
        onClick={() => setAuditEntry(a)}
        disabled={a.has_detail === false}
      >
        <Eye className="h-4 w-4" /> Lihat perubahan
      </Button>
    ),
  };

  // ---------------- Kolom: Manajemen User ----------------
  const userColumns = [
    {
      id: "name", label: "Nama", role: "name", cellClassName: "font-medium",
      render: (u) => u.name,
      cardRender: (u) => <TwoLine main={u.name} sub={u.username} />,
    },
    { id: "username", label: "Username", render: (u) => u.username, cardHidden: true },
    {
      id: "perms", label: "Hak Akses", cardClassName: "col-span-2 flex-col items-stretch gap-1.5 [&>dd]:text-left",
      render: (u) => (
        <div data-testid={`perms-${u.id}`}>
          {u.role === "superadmin" ? (
            <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Superadmin · semua tools</Badge>
          ) : (
            <div className="flex flex-wrap gap-1">
              {permissionLabels(u.permissions).length
                ? permissionLabels(u.permissions).map((l) => <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>)
                : <Badge variant="secondary" className="text-[10px] text-muted-foreground">Belum ada akses</Badge>}
            </div>
          )}
        </div>
      ),
    },
    { id: "status", label: "Status", role: "status", render: (u) => (u.active !== false ? <ActiveBadge /> : <InactiveBadge />) },
  ];
  const userActions = {
    label: "Aksi",
    renderActions: (u, { mobile }) => {
      const self = u.id === user.id;
      if (!mobile) {
        return (
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" title="Atur hak akses" data-testid={`perm-${u.id}`} onClick={() => openEdit(u, "akses")}><SlidersHorizontal className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Kelola user" data-testid={`changepwd-${u.id}`} onClick={() => openEdit(u, "identitas")}><UserCog className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={self} data-testid={`toggle-${u.id}`} onClick={() => toggleUser(u)}><Power className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={self} data-testid={`deluser-${u.id}`} onClick={() => setDelUser(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        );
      }
      const btn = "min-h-[44px] min-w-[44px] gap-2 px-3";
      return (
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" className={btn} data-testid={`perm-${u.id}-card`} onClick={() => openEdit(u, "akses")}><SlidersHorizontal className="h-4 w-4" /> Hak Akses</Button>
          <Button variant="outline" className={btn} data-testid={`changepwd-${u.id}-card`} onClick={() => openEdit(u, "identitas")}><UserCog className="h-4 w-4" /> Kelola</Button>
          <Button variant="outline" className={btn} disabled={self} data-testid={`toggle-${u.id}-card`} onClick={() => toggleUser(u)}><Power className="h-4 w-4" /> {u.active !== false ? "Nonaktifkan" : "Aktifkan"}</Button>
          <Button variant="outline" className={cn(btn, "border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive")} disabled={self} data-testid={`deluser-${u.id}-card`} onClick={() => setDelUser(u)}><Trash2 className="h-4 w-4" /> Hapus</Button>
        </div>
      );
    },
  };

  return (
    <PageContainer
      fillHeight
      testid="logs-users-page"
      pageTitle={isSuper ? "Log & Manajemen User" : "Log Aktivitas"}
      pageDescription={isSuper ? "Aktivitas login, audit mutasi, dan pengelolaan user & hak akses." : "Aktivitas login dan audit mutasi."}
    >

      <Tabs defaultValue="activity" className="md:flex md:min-h-0 md:flex-1 md:flex-col">
        {/* h-auto + flex-wrap: di layar sempit tab boleh turun baris tanpa terpotong. */}
        <TabsList className="h-auto flex-wrap justify-start gap-1 md:shrink-0">
          <TabsTrigger value="activity" data-testid="tab-activity">Log Aktivitas</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Mutasi</TabsTrigger>
          {isSuper && <TabsTrigger value="users" data-testid="tab-users">Manajemen User</TabsTrigger>}
        </TabsList>

        {/* ===================== Log Aktivitas ===================== */}
        <TabsContent value="activity" className={TAB_CONTENT}>
          <div className={TABLE_WRAP} data-testid="activity-log-card">
            <MutasiTable
              columns={activityColumns}
              data={activityRows}
              rowKey={(a) => a.id}
              isLoading={actLoading && !activityPage}
              skeletonRows={6}
              scrollClassName="overflow-auto md:min-h-0 md:flex-1"
              testid="activity-log-table"
              empty={{ icon: <Inbox />, title: "Belum ada log aktivitas", description: "Log tercatat otomatis saat ada aktivitas pengguna." }}
            />
            {activityTotal > 0 && (
              <TablePagination
                className={PAGINATION_CLS}
                page={actPage}
                pageSize={actSize}
                total={activityTotal}
                onPageChange={setActPage}
                onPageSizeChange={setActSize}
              />
            )}
          </div>
        </TabsContent>

        {/* ===================== Audit Mutasi ===================== */}
        <TabsContent value="audit" className={TAB_CONTENT}>
          <div className={TABLE_WRAP} data-testid="audit-log-card">
            <MutasiTable
              columns={auditColumns}
              data={auditRows}
              rowKey={(a) => a.id}
              actions={auditActions}
              isLoading={audLoading && !auditPage}
              skeletonRows={6}
              scrollClassName="overflow-auto md:min-h-0 md:flex-1"
              testid="audit-log-table"
              empty={{ icon: <Inbox />, title: "Belum ada log audit", description: "Log audit tercatat saat ada perubahan data." }}
            />
            {auditTotal > 0 && (
              <TablePagination
                className={PAGINATION_CLS}
                page={audPage}
                pageSize={audSize}
                total={auditTotal}
                onPageChange={setAudPage}
                onPageSizeChange={setAudSize}
              />
            )}
          </div>
        </TabsContent>

        {/* ===================== Manajemen User ===================== */}
        {isSuper && (
          <TabsContent value="users" className="space-y-5 md:min-h-0 md:flex-1 md:flex-col md:gap-5 md:space-y-0 md:data-[state=active]:flex">
            <div className="flex flex-col gap-3 md:min-h-0 md:flex-1">
              <div className="flex items-center justify-between md:shrink-0">
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

              <div className={TABLE_WRAP} data-testid="users-card">
                <MutasiTable
                  columns={userColumns}
                  data={userRows}
                  rowKey={(u) => u.id}
                  actions={userActions}
                  isLoading={usrLoading}
                  skeletonRows={4}
                  scrollClassName="overflow-auto md:min-h-0 md:flex-1"
                  testid="users-table"
                  empty={{ icon: <Inbox />, title: "Belum ada user", description: "Daftarkan user baru lewat tombol Registrasi User." }}
                />
                {users.length > usrSize && (
                  <TablePagination
                    className={PAGINATION_CLS}
                    page={usrPage}
                    pageSize={usrSize}
                    total={users.length}
                    onPageChange={setUsrPage}
                    onPageSizeChange={setUsrSize}
                    pageSizeOptions={[10, 25, 50]}
                  />
                )}
              </div>
            </div>

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

      <AuditDiffDialog entry={auditEntry} onOpenChange={(o) => !o && setAuditEntry(null)} />

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
