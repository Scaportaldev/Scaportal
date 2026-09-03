import { cn } from "@/lib/utils"

/**
 * Skeleton loader dengan efek shimmer (hanya transform + opacity).
 * Ukuran diambil dari className pemanggil, jadi posisi tidak berubah.
 */
function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-foreground/[0.07] after:to-transparent",
        className
      )}
      {...props} />
  );
}

export { Skeleton }
