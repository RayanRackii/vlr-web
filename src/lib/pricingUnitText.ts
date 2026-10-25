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
