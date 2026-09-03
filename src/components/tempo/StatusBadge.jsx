import { dueBucket, daysUntil } from "@/lib/tempoFormat";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }) {
  const lunas = status === "lunas";
  return (
    <span
      data-testid="status-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        lunas
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", lunas ? "bg-emerald-500" : "bg-rose-500")} />
      {lunas ? "Lunas" : "Belum Lunas"}
    </span>
  );
}

export function DueBadge({ dueDate, status }) {
  const bucket = dueBucket(dueDate, status);
  if (bucket === "paid" || bucket === "none" || bucket === "ok") return null;
  const d = daysUntil(dueDate);
  const map = {
    overdue: {
      text: `Lewat ${Math.abs(d)} hari`,
      cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    soon: {
      text: `${d} hari lagi`,
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    warning: {
      text: `${d} hari lagi`,
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  };
  const m = map[bucket];
  return (
    <span data-testid="due-badge"
      className={cn("inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium", m.cls)}>
      {m.text}
    </span>
  );
}

export default StatusBadge;
