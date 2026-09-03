import { ShieldCheck } from "lucide-react";
import { PERMISSION_GROUPS, normalizePermissions } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * PermissionToggles — daftar switch hak akses per-tools untuk satu user.
 *
 * - `value`    : objek {key: boolean} (boleh parsial; dinormalisasi).
 * - `onChange` : dipanggil dengan objek permissions lengkap yang sudah dinormalisasi.
 * - `locked`   : untuk Superadmin — semua switch tampil ON dan tidak bisa diubah.
 * - Sub-toggle (mis. Laporan Detail) otomatis nonaktif bila induknya OFF.
 */
export default function PermissionToggles({ value, onChange, locked = false, testidPrefix = "perm" }) {
  const perms = locked ? null : normalizePermissions(value);

  const setKey = (key, on) => {
    if (locked) return;
    onChange?.(normalizePermissions({ ...perms, [key]: on }));
  };

  const Row = ({ item, parentOn = true, child = false }) => {
    const on = locked ? true : !!perms[item.key];
    const disabled = locked || !parentOn;
    const id = `${testidPrefix}-${item.key}`;
    return (
      <div
        className={`flex items-start justify-between gap-3 rounded-md px-3 py-2.5 transition-[background-color,opacity] duration-150 ${child ? "ml-6 border-l-2 border-border/70 pl-3" : ""} ${disabled && !locked ? "opacity-55" : "hover:bg-secondary/60"}`}
        data-testid={`${id}-row`}
      >
        <div className="min-w-0">
          <Label htmlFor={id} className={`cursor-pointer ${child ? "text-sm" : "text-sm font-semibold"}`}>{item.label}</Label>
          {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
        </div>
        <Switch
          id={id}
          data-testid={id}
          checked={on}
          disabled={disabled}
          onCheckedChange={(v) => setKey(item.key, v)}
          aria-label={item.label}
        />
      </div>
    );
  };

  return (
    <div className="space-y-1" data-testid={`${testidPrefix}-toggles`}>
      {locked && (
        <p className="mb-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary" data-testid={`${testidPrefix}-locked-note`}>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Superadmin selalu memiliki akses penuh ke semua tools. Toggle tidak dapat diubah.
        </p>
      )}
      {PERMISSION_GROUPS.map((g) => (
        <div key={g.key} className="rounded-lg border border-border/80 bg-card/60 py-1">
          <Row item={g} />
          {(g.children || []).map((c) => (
            <Row key={c.key} item={c} child parentOn={locked || !!perms[g.key]} />
          ))}
        </div>
      ))}
    </div>
  );
}
