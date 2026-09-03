import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Spinner — pola dari dashboard starter (components/ui/spinner.tsx). */
function Spinner({ className, ...props }) {
  return (
    <Loader2
      data-slot="spinner"
      role="status"
      aria-label="Memuat"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
