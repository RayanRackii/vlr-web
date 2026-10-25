import type { TFunction } from "i18next"

import type { PricingUnit } from "@/api/generated/rentalPricing"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import { tenantCivilDaySpan } from "@/lib/tenantTimeZone"

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
  /** Units booked; the total is divided by it. Default 1. */
  quantity?: number
  /** Billed days for Day-unit bookings (multi-day selector). Defaults to ceil(hours/24). */
  days?: number
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
  const divisor = unit === "Hour" ? hours : unit === "Day" ? Math.max(1, window.days ?? Math.ceil(hours / 24)) : 1
  const quantity = Math.max(1, window.quantity ?? 1)
  return { amount: window.totalAmount / divisor / quantity, unit }
}

export type ReservationWordingInput = {
  pricingUnit?: PricingUnit | null
  quantity?: number | null
  days?: number | null
  startDateTime: string
  endDateTime: string
}

/**
 * Resolves the unit/quantity/days wording for a reservation line, degrading
 * gracefully when the API hasn't sent pricingUnit/days yet. Derives days from
 * the start/end span only for Day-unit bookings when not sent explicitly.
 */
export function reservationUnitWording(
  input: ReservationWordingInput,
  timeZoneId: string,
): { unit: PricingUnit | null; quantity: number; days: number | null } {
  const unit = input.pricingUnit ?? null
  const quantity = Math.max(1, input.quantity ?? 1)
  const days =
    input.days ??
    (unit === "Day" ? tenantCivilDaySpan(input.startDateTime, input.endDateTime, timeZoneId) : null)
  return { unit, quantity, days }
}
