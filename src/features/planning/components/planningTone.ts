import type { BlockTone } from "../model/gridModel"

type Tone = { block: string; dot: string; label: string }

/** Same visual language as the agenda: a tinted fill and a 3px left border in the tone colour. */
export const planningTone: Record<BlockTone, Tone> = {
  scheduled: { block: "border-l-primary bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--primary)_24%,transparent)]", dot: "bg-primary", label: "planning.status.Scheduled" },
  running: { block: "border-l-success bg-[color-mix(in_oklch,var(--success)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_24%,transparent)]", dot: "bg-success", label: "planning.status.Running" },
  cleaning: { block: "border-l-info bg-[color-mix(in_oklch,var(--info)_14%,transparent)] dark:bg-[color-mix(in_oklch,var(--info)_24%,transparent)]", dot: "bg-info", label: "planning.status.Cleaning" },
  released: { block: "border-l-muted-foreground bg-muted/60 opacity-70", dot: "bg-muted-foreground/60", label: "planning.status.Released" },
  unavailable: { block: "border-l-muted-foreground bg-muted", dot: "bg-muted-foreground", label: "planning.kind.Unavailable" },
}

export const overdueBorder = "border-l-destructive"
export const expiredClass = "border-dashed opacity-60"
