import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tinggi (h-9) dan padding TIDAK diubah. Polish: ring focus lebih jelas
 * (ring digambar di luar box sehingga tidak menggeser layout), border
 * menyala saat hover/focus.
 */
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-soft transition-[color,background-color,border-color,box-shadow] duration-200 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/70 hover:border-border focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
