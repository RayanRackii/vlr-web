import { isBrazilSlotStartInPast } from "@/lib/brazilTimeZone"

/**
 * True when this civil slot start is already reached on the tenant business
 * clock (America/Sao_Paulo). Future civil dates stay offerable.
 */
export function isPastTenantSlotStart(
  dateIso: string,
  startTime: string,
  now: Date = new Date(),
): boolean {
  return isBrazilSlotStartInPast(dateIso, startTime, now)
}

/** Drops slots whose start is already in the past on the tenant business clock. */
export function withoutPastTenantSlots<T extends { startTime: string }>(
  dateIso: string,
  slots: readonly T[],
  now: Date = new Date(),
): T[] {
  return slots.filter(
    (slot) => !isPastTenantSlotStart(dateIso, slot.startTime, now),
  )
}
