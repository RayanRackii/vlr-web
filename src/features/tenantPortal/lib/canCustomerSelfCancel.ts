const SELF_CANCEL_STATUSES = new Set(["PendingDeposit", "Confirmed"])

/** UX-only gate. The API remains the authority for Customer self-cancel. */
export function canCustomerSelfCancel(
  status: string,
  startDateTimeIso: string,
  nowMs: number = Date.now(),
): boolean {
  if (!SELF_CANCEL_STATUSES.has(status)) {
    return false
  }

  const startMs = Date.parse(startDateTimeIso)
  if (Number.isNaN(startMs)) {
    return false
  }

  return startMs > nowMs
}
