import { FeatureRouteTabs } from "@/components/layout/FeatureRouteTabs"
import { useLocation } from "react-router-dom"
import { useState } from "react"
import { ReservationsHeader } from "@/features/rentals/components/ReservationsHeader"
import { reservationTabs } from "@/features/rentals/navigationTabs"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"
import "./reservations.css"

export function ReservationsScreen() {
  const { pathname } = useLocation()
  const [date, setDate] = useState<string>()
  const isReservations = pathname.replace(/\/+$/, "") === "/configuracoes/reservas"
  return (
    <div className="reservations-layout reservations-screen">
    <FeatureRouteTabs
      labelKey="nav.reservations"
      tabs={reservationTabs}
      header={isReservations ? <ReservationsHeader date={date || undefined} /> : undefined}
      content={{
        "/configuracoes/reservas": <ReservationsPage showHeader={false} onDateChange={setDate} />,
        "/configuracoes/politica-reservas": <BookingPolicyPage />,
      }}
    />
    </div>
  )
}
