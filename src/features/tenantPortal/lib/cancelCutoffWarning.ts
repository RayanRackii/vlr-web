import { tenantCivilInstant } from "@/lib/tenantTimeZone"

/**
 * True when booking this slot now would leave it uncancellable the moment it
 * is confirmed — the start time already falls inside the resource's
 * cancellation cutoff window. A warning, not a block: the booking still goes
 * through.
 */
export function isWithinCancelCutoff(
  cutoffHours: number | null | undefined,
  date: string,
  startTime: string,
  timeZoneId: string,
  now: Date = new Date(),
): boolean {
  if (cutoffHours === null || cutoffHours === undefined || cutoffHours <= 0) {
    return false
  }

  const start = tenantCivilInstant(date, startTime, timeZoneId)
  const hoursUntilStart = (start.getTime() - now.getTime()) / 3_600_000
  return hoursUntilStart >= 0 && hoursUntilStart < cutoffHours
}
