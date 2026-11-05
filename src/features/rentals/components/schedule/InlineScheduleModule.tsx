import { useId, type ReactNode } from "react"
import { Maximize2, Plus, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type InlineScheduleModuleProps = {
  title: string
  description: ReactNode
  icon: LucideIcon
  open: boolean
  disabled: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function InlineScheduleModule({
  title,
  description,
  icon: Icon,
  open,
  disabled,
  onOpenChange,
  children,
}: InlineScheduleModuleProps) {
  const id = useId()
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h3>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={title}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          disabled={disabled}
          onClick={() => onOpenChange(!open)}
        >
          {open ? <Maximize2 aria-hidden /> : <Plus aria-hidden />}
        </Button>
      </header>
      <div id={`${id}-body`} hidden={!open} className="mt-4 space-y-4">
        {open ? children : null}
      </div>
    </section>
  )
}
