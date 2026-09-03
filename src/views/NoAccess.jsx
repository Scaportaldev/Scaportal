import { ShieldOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Ditampilkan bila user login tetapi belum diberi satu pun toggle akses oleh Superadmin. */
export default function NoAccess() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-md pt-10" data-testid="no-access-page">
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-500/15 text-amber-600">
          <ShieldOff className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-bold">Belum Ada Akses</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Halo {user?.name}. Akun Anda belum diberi akses ke tools apa pun.
          Hubungi Superadmin untuk mengaktifkan hak akses Anda.
        </p>
        <Button variant="outline" className="mt-6" data-testid="no-access-logout" onClick={() => logout("manual")}>
          Keluar
        </Button>
      </Card>
    </div>
  );
}
