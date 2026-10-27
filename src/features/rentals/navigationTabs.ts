import type { NavigationTab } from "@/components/layout/navigationTabs"

export const reservationTabs = [
  { labelKey: "nav.reservations", to: "/configuracoes/reservas", permission: "rentals.reservations.read", modules: ["rentals"] },
  { labelKey: "nav.bookingPolicy", to: "/configuracoes/politica-reservas", permission: "rentals.booking_policy.read", modules: ["rentals"] },
] as const satisfies readonly NavigationTab[]
