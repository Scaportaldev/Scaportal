import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

/** Padding & ukuran teks tidak diubah — hanya warna, ring, dan transisi. */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-[color,background-color,box-shadow,opacity] duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-ring/45 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-soft hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/75",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/85",
        outline: "border-border/80 text-foreground hover:border-border hover:bg-muted/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
