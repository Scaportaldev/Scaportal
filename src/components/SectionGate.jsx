import { useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth, apiError } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SectionGate({ title, children }) {
  const { user, sectionUnlocked, unlockSection } = useAuth();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  if (user?.role === "superadmin" || sectionUnlocked) return children;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await unlockSection(pwd);
      toast.success("Akses dibuka untuk sesi ini.");
    } catch (err) {
      toast.error(apiError(err, "Password akses salah"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-amber-500/15 text-amber-600">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Section Terproteksi</h2>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
        <p className="mb-4 flex items-start gap-2 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Masukkan password kunci akses sementara untuk membuka section ini pada sesi login saat ini.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="section-pwd">Password Akses</Label>
            <Input
              id="section-pwd"
              type="password"
              data-testid="section-password-input"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••••"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" data-testid="section-unlock-button" disabled={loading}>
            {loading ? "Memverifikasi…" : "Buka Akses"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
