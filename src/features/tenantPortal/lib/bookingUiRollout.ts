/** The rollout is opt-in; legacy handoffs only apply for enabled tenants. */
export function shouldUseNewBookingUi(
  enabled: boolean | undefined,
  legacyBooking: string | null,
): boolean {
  return enabled === true && legacyBooking !== "1"
}
