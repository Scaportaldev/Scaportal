import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Empty state primitives — pola dari 21st.dev ("Empty State Card").
 * Dipakai untuk tabel/daftar yang belum punya data supaya tidak terasa kosong.
 */

const Empty = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center",
      className
    )}
    {...props}
  />
));
Empty.displayName = "Empty";

const EmptyHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col items-center gap-2", className)} {...props} />
));
EmptyHeader.displayName = "EmptyHeader";

const EmptyMedia = React.forwardRef(({ className, variant = "icon", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mb-1 grid place-items-center transition-transform duration-200 ease-out",
      variant === "icon" &&
        "h-12 w-12 rounded-xl bg-muted/70 text-muted-foreground ring-1 ring-border/70 [&_svg]:h-6 [&_svg]:w-6",
      className
    )}
    {...props}
  />
));
EmptyMedia.displayName = "EmptyMedia";

const EmptyTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-display text-base font-bold tracking-tight text-foreground", className)}
    {...props}
  />
));
EmptyTitle.displayName = "EmptyTitle";

const EmptyDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("max-w-sm text-sm text-muted-foreground", className)}
    {...props}
  />
));
EmptyDescription.displayName = "EmptyDescription";

const EmptyContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-wrap items-center justify-center gap-2", className)} {...props} />
));
EmptyContent.displayName = "EmptyContent";

export { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent };
