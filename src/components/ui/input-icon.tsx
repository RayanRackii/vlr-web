import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type InputWithIconProps = React.ComponentProps<"input"> & {
  icon: React.ReactNode
}

function InputWithIcon({ icon, className, ...props }: InputWithIconProps) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground"
      >
        {icon}
      </span>
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  )
}

export { InputWithIcon }
