import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function nameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)

  if (parts.length >= 2) {
    const first = parts[0]?.[0]
    const second = parts[1]?.[0]
    if (first && second) {
      return `${first}${second}`.toUpperCase()
    }
  }

  const compact = name.trim()
  if (compact.length === 0) {
    return "?"
  }
  return compact.slice(0, 2).toUpperCase()
}

export function ReadOnlyValue({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="min-h-11 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm break-words">
        {value}
      </p>
    </div>
  )
}

export function SensitiveReadOnlyValue({
  label,
  masked,
  revealed,
  showLabel,
  hideLabel,
  className,
}: {
  label: string
  masked: string
  revealed: string
  showLabel: string
  hideLabel: string
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative">
        <p className="min-h-11 rounded-md border border-border/60 bg-muted/40 py-2 pl-3 pr-14 text-sm break-words">
          {visible ? revealed : masked}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="touch-target absolute right-1 top-1/2 -translate-y-1/2"
          aria-pressed={visible}
          aria-label={visible ? hideLabel : showLabel}
          onClick={() => {
            setVisible((current) => !current)
          }}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
