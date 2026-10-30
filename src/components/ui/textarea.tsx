import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive aria-invalid:focus-visible:outline-destructive md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
