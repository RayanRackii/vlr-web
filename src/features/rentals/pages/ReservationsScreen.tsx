import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { reservationTabs } from "@/features/rentals/navigationTabs"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"

export function ReservationsScreen() {
  return (
    <FeatureRouteTabs
      labelKey="nav.reservations"
      tabs={reservationTabs}
      content={{
        "/configuracoes/reservas": <ReservationsPage />,
        "/configuracoes/politica-reservas": <BookingPolicyPage />,
      }}
    />
  )
}
