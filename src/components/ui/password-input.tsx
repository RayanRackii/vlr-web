import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { iconProps } from "@/lib/icon"
import { cn } from "@/lib/utils"

type PasswordInputProps = React.ComponentProps<"input"> & {
  icon?: React.ReactNode
  showLabel: string
  hideLabel: string
}

function PasswordInput({
  icon,
  showLabel,
  hideLabel,
  className,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      {icon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground"
        >
          {icon}
        </span>
      ) : null}
      <Input
        type={visible ? "text" : "password"}
        className={cn(icon && "pl-9", "pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          setVisible((current) => !current)
        }}
        aria-label={visible ? hideLabel : showLabel}
        className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        {visible ? <EyeOff {...iconProps("sm")} /> : <Eye {...iconProps("sm")} />}
      </button>
    </div>
  )
}

export { PasswordInput }
