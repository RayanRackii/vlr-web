import * as React from "react"

import { fieldControlClass } from "@/components/ui/fieldControl"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg px-3 py-2 text-base placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
        fieldControlClass,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
