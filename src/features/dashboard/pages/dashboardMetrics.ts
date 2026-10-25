import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"

type RentalsMetrics = NonNullable<DashboardMetrics["rentals"]>

/** Cancelled bookings never happened; they don't belong in a "reservations today" count. */
export function reservationsTodayTotal(
  rentals: Pick<
    RentalsMetrics,
    "reservationsTodayPendingDeposit" | "reservationsTodayConfirmed" | "reservationsTodayCompleted"
  >,
): number {
  return (
    rentals.reservationsTodayPendingDeposit +
    rentals.reservationsTodayConfirmed +
    rentals.reservationsTodayCompleted
  )
}

/** OpenHours resources have no pre-created slots, so "0/0" is a false signal rather than real emptiness. */
export function hasSlotsToday(
  rentals: Pick<RentalsMetrics, "slotsAvailableToday" | "slotsBookedToday">,
): boolean {
  return rentals.slotsAvailableToday + rentals.slotsBookedToday > 0
}

