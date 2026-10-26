import { isTenantSlotStartInPast } from "@/lib/tenantTimeZone"

/**
 * True when this civil slot start is already reached on the tenant business
 * clock. Future civil dates stay offerable.
 */
export function isPastTenantSlotStart(
  dateIso: string,
  startTime: string,
  timeZoneId: string,
  now: Date = new Date(),
): boolean {
  return isTenantSlotStartInPast(dateIso, startTime, timeZoneId, now)
}

/** Drops slots whose start is already in the past on the tenant business clock. */
export function withoutPastTenantSlots<T extends { startTime: string }>(
  dateIso: string,
  slots: readonly T[],
  timeZoneId: string,
  now: Date = new Date(),
): T[] {
  return slots.filter(
    (slot) => !isPastTenantSlotStart(dateIso, slot.startTime, timeZoneId, now),
  )
}
