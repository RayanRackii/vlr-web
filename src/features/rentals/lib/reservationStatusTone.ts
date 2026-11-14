import type { StatusTone } from "@/components/ui/status-tones"
import type { ReservationStatus } from "@/features/rentals/services/reservationsService"

/** Domain status to shared tone. */
export const reservationStatusTone = {
  PendingDeposit: "warning",
  Confirmed: "info",
  Completed: "success",
  Canceled: "neutral",
} as const satisfies Record<ReservationStatus, StatusTone>
