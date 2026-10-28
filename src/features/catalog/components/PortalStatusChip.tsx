import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Visual tone of a portal status chip. */
export type PortalStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"

const TONE_CLASS: Record<PortalStatusTone, string> = {
  success: "portal-chip-success",
  warning: "portal-chip-warning",
  danger: "portal-chip-danger",
  info: "portal-chip-info",
  neutral: "portal-chip-neutral",
}

/**
 * Shared status pill for the customer portal (Pedidos, Minhas solicitações,
 * Minhas reservas). `aria-label` names the status for assistive tech when the
 * visible label alone is not enough context.
 */
export function PortalStatusChip({
  tone,
  children,
  "aria-label": ariaLabel,
}: {
  tone: PortalStatusTone
  children: ReactNode
  "aria-label"?: string
}) {
  return (
    <span className={cn("portal-chip", TONE_CLASS[tone])} aria-label={ariaLabel}>
      {children}
    </span>
  )
}
