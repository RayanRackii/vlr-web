/**
 * Shared status tones. Features map their own domain statuses onto a tone and
 * import only this type; the visual treatment lives here, once.
 *
 * - neutral: draft, cancelled-like, inactive
 * - info: scheduled, confirmed
 * - progress: in production, in progress
 * - warning: waiting for someone (approval, deposit)
 * - success: done, completed
 * - danger: failed, overdue, rejected
 */
export type StatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger"

type ToneStyle = {
  /** Badge pill: bg, text and border. */
  badge: string
  /** Dot fill. */
  dot: string
  /** Border of an active filter chip. */
  chipActive: string
}

export const STATUS_TONE_STYLES: Record<StatusTone, ToneStyle> = {
  neutral: {
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    chipActive: "border-muted-foreground",
  },
  info: {
    badge:
      "border-transparent bg-[color-mix(in_oklch,var(--info)_16%,transparent)] text-[color-mix(in_oklch,var(--info)_78%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--info)_26%,transparent)]",
    dot: "bg-info",
    chipActive: "border-info",
  },
  progress: {
    badge:
      "border-transparent bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[color-mix(in_oklch,var(--primary)_78%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--primary)_24%,transparent)]",
    dot: "bg-primary",
    chipActive: "border-primary",
  },
  warning: {
    badge:
      "border-transparent bg-[color-mix(in_oklch,var(--warning)_22%,transparent)] text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)]",
    dot: "bg-warning",
    chipActive: "border-warning",
  },
  success: {
    badge:
      "border-transparent bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--success)_26%,transparent)]",
    dot: "bg-success",
    chipActive: "border-success",
  },
  danger: {
    badge:
      "border-transparent bg-[color-mix(in_oklch,var(--destructive)_14%,transparent)] text-[color-mix(in_oklch,var(--destructive)_78%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--destructive)_24%,transparent)]",
    dot: "bg-destructive",
    chipActive: "border-destructive",
  },
}
