import type { TFunction } from "i18next"

import type { PricingUnit } from "@/api/generated/rentalPricing"
import { formatLocaleCurrency } from "@/lib/localeFormat"

/**
 * Unit-aware price text ("R$ 10,00/hora", "/horário", "/dia", "R$ 10,00 fixo").
 * Reads the suffix from `${keyPrefix}.${unit}` so each screen keeps its own
 * locale namespace while sharing one formatting rule.
 */
export function formatUnitPriceText(
  amount: number,
  unit: PricingUnit,
  currency: string,
  locale: string,
  t: TFunction,
  keyPrefix: string,
): string {
  return t(`${keyPrefix}.${unit}`, {
    lng: locale,
    amount: formatLocaleCurrency(amount, currency, locale),
  })
}

export type PriceableWindow = {
  startTime: string
  endTime: string
  totalAmount: number | null
  pricingUnit?: PricingUnit | null
}

/**
 * The per-unit rate for a window's total price ("R$ 120 for 2h" -> "R$ 60/hora").
 * `null` when the window has no price or a non-positive duration.
 */
export function unitPriceForWindow(
  window: PriceableWindow,
): { amount: number; unit: PricingUnit } | null {
  if (window.totalAmount === null || window.totalAmount === undefined) {
    return null
  }
  const hours =
    (Date.parse(`1970-01-01T${window.endTime}`) - Date.parse(`1970-01-01T${window.startTime}`)) /
    3_600_000
  if (!(hours > 0)) {
    return null
  }
  const unit = window.pricingUnit ?? "Hour"
  const divisor = unit === "Hour" ? hours : unit === "Day" ? Math.max(1, Math.ceil(hours / 24)) : 1
  return { amount: window.totalAmount / divisor, unit }
}
