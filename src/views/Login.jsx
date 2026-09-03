import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, apiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, ShieldCheck, Users, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

const BG = "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username.trim(), password, role);
      toast.success("Berhasil masuk.");
      navigate("/");
    } catch (err) { toast.error(apiError(err, "Login gagal")); }
    finally { setLoading(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={BG} alt="Percetakan SCA" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/75" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_35%,rgba(0,0,0,0.35)_100%)]" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <div className="stagger-in flex items-center gap-3">
            <Logo size={48} />
            <span className="font-display text-2xl font-extrabold tracking-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>SCA PORTAL</span>
          </div>
          <div className="stagger-in" style={{ animationDelay: "80ms" }}>
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.65)" }}>
              Portal Terpadu Percetakan SCA
            </h1>
            <p className="mt-3 max-w-md text-base text-zinc-100 lg:text-lg" style={{ textShadow: "0 1px 5px rgba(0,0,0,0.6)" }}>
              Laporan Stok, Tracking PO, Stok Klien, Jatuh Tempo Klien, dan Kalkulator HPP — dalam satu aplikasi.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center bg-background p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.07),transparent_70%)]" />
        <div className="stagger-in relative w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <span className="font-display text-xl font-extrabold tracking-tight">SCA PORTAL</span>
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight">Masuk</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih role & gunakan akun yang telah terdaftar.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Nama User</Label>
              <Input id="username" data-testid="login-username" value={username}
                onChange={(e) => setUsername(e.target.value)} placeholder="cth: Jeffsca" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Pilih Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="login-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">
                    <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Superadmin</span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Admin / PIC</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground pt-0.5">Role yang dipilih harus cocok dengan akun.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" data-testid="login-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full gap-2 group" data-testid="login-submit" disabled={loading}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <LogIn className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
              {loading ? "Memproses…" : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
