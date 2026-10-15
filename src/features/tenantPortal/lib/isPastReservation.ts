/** A reservation is past once its end instant has been reached. */
export function isPastReservation(
  endDateTimeIso: string,
  nowMs: number = Date.now(),
): boolean {
  const endMs = Date.parse(endDateTimeIso)
  if (Number.isNaN(endMs)) {
    return false
  }

  return endMs <= nowMs
}
