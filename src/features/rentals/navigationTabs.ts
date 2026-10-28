import type { NavigationTab } from "@/components/layout/navigationTabs"
import { CalendarDays, ListFilter } from "lucide-react"

export const reservationTabs = [
  { labelKey: "nav.reservations", to: "/configuracoes/reservas", permission: "rentals.reservations.read", modules: ["rentals"], icon: CalendarDays },
  { labelKey: "nav.bookingPolicy", to: "/configuracoes/politica-reservas", permission: "rentals.booking_policy.read", modules: ["rentals"], icon: ListFilter },
] as const satisfies readonly NavigationTab[]
