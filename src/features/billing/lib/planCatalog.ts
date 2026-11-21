import {
  PACKAGE_KEYS,
  type PackageKey,
  type PlanLimits,
  type PublicPlan,
} from "@/features/billing/schemas/billingSchemas"
import { formatLocaleCurrency } from "@/lib/localeFormat"

/** Optional extras (spec D4). Catalog entries; the purchase flow comes later, so this is display data. */
export const PLAN_ADD_ONS = [
  { key: "module", priceCents: 6900, currency: "BRL" },
  { key: "unit", priceCents: 4900, currency: "BRL" },
  { key: "whatsapp", priceCents: 5900, currency: "BRL" },
] as const

export type BillingCycle = "monthly" | "annual"

/** Packages that have at least one plan, in the canonical order; falls back to all keys. */
export function availablePackages(plans: readonly PublicPlan[]): PackageKey[] {
  const present = PACKAGE_KEYS.filter((key) =>
    plans.some((plan) => plan.packageKey === key),
  )
  return present.length > 0 ? present : [...PACKAGE_KEYS]
}

export function plansForPackage(
  plans: readonly PublicPlan[],
  packageKey: PackageKey,
): PublicPlan[] {
  return plans
    .filter((plan) => plan.packageKey === packageKey)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Price shown on a card: the monthly price, or the annual price spread over 12 months. */
export function displayMonthlyCents(plan: PublicPlan, cycle: BillingCycle): number {
  if (cycle === "annual" && plan.annualPriceCents > 0) {
    return Math.round(plan.annualPriceCents / 12)
  }
  return plan.monthlyPriceCents
}

/** Whole months free that the annual price gives (10x monthly -> 2). */
export function freeMonthsOnAnnual(plan: PublicPlan): number {
  if (plan.monthlyPriceCents <= 0 || plan.annualPriceCents <= 0) {
    return 0
  }
  const free = Math.round(
    (plan.monthlyPriceCents * 12 - plan.annualPriceCents) / plan.monthlyPriceCents,
  )
  return Math.max(0, free)
}

export function formatCents(cents: number, currency: string, locale: string): string {
  return formatLocaleCurrency(cents / 100, currency, locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
}

export const LIMIT_KEYS = [
  "assets",
  "rentableResources",
  "users",
  "units",
  "whatsappMessagesMonth",
] as const

export type LimitKey = (typeof LIMIT_KEYS)[number]

/**
 * Limits worth listing on a card. `undefined` (absent) is skipped; `null` means unlimited.
 * `assets` is hidden when `rentableResources` is present, so a card does not list the same
 * count twice.
 */
export function listedLimits(
  limits: PlanLimits,
): { key: LimitKey; value: number | null }[] {
  return LIMIT_KEYS.flatMap((key) => {
    const value = limits[key]
    if (value === undefined) {
      return []
    }
    if (key === "assets" && limits.rentableResources !== undefined) {
      return []
    }
    return [{ key, value }]
  })
}
