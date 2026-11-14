import { queryOptions } from "@tanstack/react-query"
import { addCivilDays, startOfCivilWeek } from "@/features/catalog/components/agenda/agendaLayout"
import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import { listCatalogOrders, listCatalogProducts, listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import { fetchAdminScheduleDay, listAdminRentalAssets, listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { tenantKey } from "@/lib/queryKeys"
import { tenantCivilInstant } from "@/lib/tenantTimeZone"
import type { AgendaOrderLabel } from "./dayGridModel"
import type { AgendaState } from "./urlState"

export type AgendaRange = {
  rangeStart: string
  dates: string[]
  /** Instants (ISO) bounding the visible range in the tenant zone. */
  from: string
  to: string
  /** Reservations bind DateOnly: the last civil day, inclusive. */
  reservationTo: string
}

export function agendaRange(state: Pick<AgendaState, "visao" | "date">, zone: string): AgendaRange {
  const rangeStart = state.visao === "semana" ? startOfCivilWeek(state.date) : state.date
  const rangeDays = state.visao === "semana" ? 7 : 1
  const dates = Array.from({ length: rangeDays }, (_, index) => addCivilDays(rangeStart, index))
  return {
    rangeStart,
    dates,
    from: tenantCivilInstant(rangeStart, "00:00:00", zone).toISOString(),
    to: tenantCivilInstant(addCivilDays(rangeStart, rangeDays), "00:00:00", zone).toISOString(),
    reservationTo: dates[dates.length - 1] ?? rangeStart,
  }
}

// Range data can change on other screens (new reservation, block), so a remount revalidates it.
const rangeData = { refetchOnMount: "always" } as const

const orderLabel = (orders: CatalogOrder[]): AgendaOrderLabel[] =>
  orders.map(({ id, displayNumber, customerName }) => ({ id, displayNumber, customerName }))
const orderOption = (orders: CatalogOrder[]) =>
  orders.map(({ id, displayNumber, customerName }) => ({ id, label: `${displayNumber} · ${customerName}` }))
const productOption = (products: Awaited<ReturnType<typeof listCatalogProducts>>) =>
  products.map(({ id, name }) => ({ id, label: name }))

/** Static-ish lists, shared by every agenda hook through the same key. */
export const agendaQueries = {
  assets: (tenantId: string | null) => queryOptions({
    queryKey: tenantKey(tenantId, "rental-assets"),
    queryFn: ({ signal }) => listAdminRentalAssets({ signal }),
  }),
  kinds: (tenantId: string | null) => queryOptions({
    queryKey: tenantKey(tenantId, "occupancy-kinds"),
    queryFn: ({ signal }) => listOccupancyKinds({ signal }),
  }),
  products: (tenantId: string | null) => queryOptions({
    queryKey: tenantKey(tenantId, "catalog-products"),
    queryFn: ({ signal }) => listCatalogProducts(undefined, { signal }),
    select: productOption,
  }),
  resourceAgenda: (tenantId: string | null, { from, to }: AgendaRange) => queryOptions({
    queryKey: tenantKey(tenantId, "catalog-resource-agenda", from, to),
    queryFn: ({ signal }) => listCatalogResourceAgenda({ from, to }, { signal }),
    ...rangeData,
  }),
  reservations: (tenantId: string | null, { rangeStart, reservationTo }: AgendaRange) => queryOptions({
    queryKey: tenantKey(tenantId, "reservations", rangeStart, reservationTo),
    queryFn: ({ signal }) => listAdminReservations({ from: rangeStart, to: reservationTo }, { signal }),
    ...rangeData,
  }),
  scheduleDay: (tenantId: string | null, date: string) => queryOptions({
    queryKey: tenantKey(tenantId, "schedule-day", date),
    queryFn: ({ signal }) => fetchAdminScheduleDay(date, undefined, { signal }),
    ...rangeData,
  }),
  /** One request per visible range; labels and the order search read it through `select`. */
  orders: (tenantId: string | null, { from, to }: AgendaRange) => queryOptions({
    queryKey: tenantKey(tenantId, "catalog-orders", from, to),
    queryFn: ({ signal }) => listCatalogOrders({ from, to }, { signal }),
    ...rangeData,
  }),
}
export const agendaOrderSelect = { labels: orderLabel, options: orderOption }
