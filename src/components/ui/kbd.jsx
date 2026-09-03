import { cn } from "@/lib/utils";

/**
 * Kbd — pola dari next-shadcn-dashboard-starter (components/ui/kbd.tsx).
 * Dipakai untuk menampilkan shortcut keyboard, mis. ⌘K / Ctrl K.
 */
function Kbd({ className, ...props }) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm border border-border/60 bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }) {
  return <span data-slot="kbd-group" className={cn("inline-flex items-center gap-1", className)} {...props} />;
}

export { Kbd, KbdGroup };
