import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { STATUS_TONE_STYLES, type StatusTone } from "@/components/ui/status-tones"
import { cn } from "@/lib/utils"

/** 8px status dot. Decorative: the label next to it carries the meaning. */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-status-tone={tone}
      className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_TONE_STYLES[tone].dot, className)}
    />
  )
}

/** Pill with a tone dot and the status label. */
export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="outline"
      data-status-tone={tone}
      className={cn("h-auto min-h-6 gap-1.5 px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE_STYLES[tone].badge, className)}
    >
      <StatusDot tone={tone} />
      {children}
    </Badge>
  )
}
