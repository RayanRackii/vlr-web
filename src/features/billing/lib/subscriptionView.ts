import type { StatusTone } from "@/components/ui/status-tones"
import type { TenantBillingSubscription } from "@/features/billing/schemas/subscriptionSchemas"

export const BILLING_PAGE_PATH = "/configuracoes/plano"
export const BILLING_PERMISSION = "core.settings.billing"

export const KNOWN_STATUSES = ["trialing", "active", "past_due", "read_only", "canceled"] as const

export function statusTone(status: string | null): StatusTone {
  switch (status) {
    case "active":
      return "success"
    case "trialing":
      return "info"
    case "past_due":
      return "warning"
    case "read_only":
      return "danger"
    default:
      return "neutral"
  }
}

/** "Assinar" is offered while there is no paid subscription running; otherwise "Trocar plano". */
export function canSubscribe(subscription: TenantBillingSubscription): boolean {
  return (
    !subscription.hasSubscription ||
    subscription.status === "trialing" ||
    subscription.status === "read_only" ||
    subscription.status === "canceled"
  )
}

export function canManagePaidPlan(subscription: TenantBillingSubscription): boolean {
  return (
    subscription.hasSubscription &&
    subscription.billingMode !== "manual" &&
    (subscription.status === "active" || subscription.status === "past_due")
  )
}

export const USAGE_KEYS = ["assets", "rentableResources", "users", "units"] as const
export type UsageKey = (typeof USAGE_KEYS)[number]

export type UsageRow = {
  key: UsageKey
  used: number
  /** null = unlimited. */
  limit: number | null
  /** 0..1, 0 when unlimited. */
  ratio: number
}

export function usageRows(subscription: TenantBillingSubscription): UsageRow[] {
  return USAGE_KEYS.map((key) => {
    const used = subscription.usage[key]
    const raw = subscription.planLimits[key]
    const limit = subscription.limitsUnlimited || raw === null || raw === undefined ? null : raw
    const ratio = limit === null ? 0 : limit <= 0 ? (used > 0 ? 1 : 0) : Math.min(1, used / limit)
    return { key, used, limit, ratio }
  })
}
