import { useEffect, useMemo, useState } from "react"
import { addCivilDays, startOfCivilWeek } from "@/features/catalog/components/agenda/agendaLayout"
import { listCatalogOrders, listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import {
  fetchAdminScheduleDay,
  listAdminRentalAssets,
  listOccupancyKinds,
  type AdminDaySlot,
} from "@/features/rentals/services/scheduleService"
import { tenantCivilInstant } from "@/lib/tenantTimeZone"
import { buildAgendaDay, buildAgendaWeek, type AgendaDaySources, type AgendaOrderLabel } from "./dayGridModel"
import { agendaTypes, type AgendaState } from "./urlState"

const emptySources = (): AgendaDaySources => ({
  assets: [],
  catalog: { resources: [], items: [] },
  reservations: [],
  slots: [],
  kinds: [],
})

type AgendaAccess = {
  assets: boolean
  schedule: boolean
  reservations: boolean
  orders: boolean
}

export const agendaSourceIds = ["assets", "orders", "reservations", "schedule", "kinds"] as const
export type AgendaSourceId = (typeof agendaSourceIds)[number]

/**
 * Staff day occupancy for `/agenda`. Work orders are not loaded: the list API
 * has an asset and a date, not a rental asset or a start and end.
 */
export function useAgendaDay(state: AgendaState, zone: string, access: AgendaAccess, tenantId: string | null, enabled: boolean, focusedProductId?: string | null) {
  const [sources, setSources] = useState<AgendaDaySources>(emptySources)
  const [orderLabels, setOrderLabels] = useState<AgendaOrderLabel[]>([])
  const [failedSources, setFailedSources] = useState<AgendaSourceId[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const canLoad = enabled && (access.assets || access.schedule || access.reservations || access.orders)
  const rangeStart = state.visao === "semana" ? startOfCivilWeek(state.date) : state.date
  const rangeDays = state.visao === "semana" ? 7 : 1
  const requestKey = [
    state.visao,
    rangeStart,
    rangeDays,
    zone,
    tenantId ?? "",
    access.assets,
    access.schedule,
    access.reservations,
    access.orders,
  ].join("|")

  useEffect(() => {
    if (!canLoad) return
    let active = true
    const dates = Array.from({ length: rangeDays }, (_, index) => addCivilDays(rangeStart, index))
    const from = tenantCivilInstant(rangeStart, "00:00:00", zone).toISOString()
    const to = tenantCivilInstant(addCivilDays(rangeStart, rangeDays), "00:00:00", zone).toISOString()
    // Reservations bind DateOnly (yyyy-MM-dd). `to` is the last civil day, inclusive of that day.
    const reservationTo = dates[dates.length - 1] ?? rangeStart
    const schedulePromise: Promise<{ slots: AdminDaySlot[]; failed: boolean }> = access.schedule
      ? Promise.allSettled(dates.map((date) => fetchAdminScheduleDay(date))).then((results) => ({
          failed: results.some((result) => result.status === "rejected"),
          slots: results.flatMap((result) => result.status === "fulfilled" ? result.value.slots : []),
        }))
      : Promise.resolve({ slots: [], failed: false })
    const pending = [
      access.assets ? listAdminRentalAssets() : Promise.resolve([]),
      access.orders ? listCatalogResourceAgenda({ from, to }) : Promise.resolve({ resources: [], items: [] }),
      access.reservations ? listAdminReservations({ from: rangeStart, to: reservationTo }) : Promise.resolve([]),
      schedulePromise,
      access.schedule ? listOccupancyKinds() : Promise.resolve([]),
      access.orders
        ? listCatalogOrders().then((orders) => orders.map((order) => ({
            id: order.id,
            displayNumber: order.displayNumber,
            customerName: order.customerName,
          })))
        : Promise.resolve([]),
    ] as const

    void Promise.allSettled(pending).then((results) => {
      if (!active) return
      const [assets, catalog, reservations, schedule, kinds, labels] = results
      const scheduleValue = schedule.status === "fulfilled" ? schedule.value : { slots: [], failed: true }
      const failed: AgendaSourceId[] = []
      if (assets.status === "rejected") failed.push("assets")
      if (catalog.status === "rejected") failed.push("orders")
      if (reservations.status === "rejected") failed.push("reservations")
      if (schedule.status === "rejected" || scheduleValue.failed) failed.push("schedule")
      if (kinds.status === "rejected") failed.push("kinds")
      setOrderLabels(labels.status === "fulfilled" ? labels.value : [])
      setFailedSources(failed)
      setSources({
        assets: assets.status === "fulfilled" ? assets.value : [],
        catalog: catalog.status === "fulfilled" ? catalog.value : { resources: [], items: [] },
        reservations: reservations.status === "fulfilled" ? reservations.value : [],
        slots: scheduleValue.slots,
        kinds: kinds.status === "fulfilled" ? kinds.value : [],
      })
      setLoadedKey(requestKey)
    })

    return () => {
      active = false
    }
  }, [access.assets, access.orders, access.reservations, access.schedule, canLoad, rangeDays, rangeStart, requestKey, zone])

  const loaded = canLoad && loadedKey === requestKey
  const none = useMemo(() => emptySources(), [])
  const ready = loaded ? sources : none
  const labels = useMemo(() => new Map((loaded ? orderLabels : []).map((order) => [order.id, order])), [loaded, orderLabels])
  const stateKey = JSON.stringify([state.visao, state.date, state.recursos, state.produto, state.pedido, state.tipo, state.livres, state.fechadas])
  const derived = useMemo(() => {
    const current = JSON.parse(stateKey) as [AgendaState["visao"], string, string[], string | null, string | null, AgendaState["tipo"], boolean, boolean]
    const view: AgendaState = { visao: current[0], date: current[1], recursos: current[2], produto: current[3], pedido: current[4], tipo: current[5], livres: current[6], fechadas: current[7] }
    // Chip counts ignore the type filter itself; resources ignore every filter so the tree stays complete.
    const countState = { ...view, tipo: null }
    const typeCounts: Record<(typeof agendaTypes)[number], number> = { reserva: 0, pedido: 0, manutencao: 0, bloqueio: 0 }
    if (view.visao === "semana") {
      for (const row of buildAgendaWeek(ready, countState, zone, labels).rows) for (const cell of row.cells) for (const kind of agendaTypes) typeCounts[kind] += cell.counts[kind]
    } else {
      for (const row of buildAgendaDay(ready, countState, zone, labels).rows) for (const block of row.blocks) typeCounts[block.kind] += 1
    }
    const resources = buildAgendaDay(ready, { ...view, recursos: [], livres: false, tipo: null, produto: null, pedido: null }, zone, labels).rows
      .map(({ id, name, categoryId, categoryName }) => ({ id, name, categoryId, categoryName }))
    return {
      typeCounts,
      resources,
      focusedWeek: focusedProductId ? buildAgendaWeek(ready, { ...view, produto: focusedProductId, tipo: "pedido" }, zone, labels).rows : undefined,
      day: buildAgendaDay(ready, view, zone, labels),
      week: buildAgendaWeek(ready, view, zone, labels),
    }
  }, [ready, labels, stateKey, zone, focusedProductId])
  return {
    ...derived,
    loading: canLoad && loadedKey !== requestKey,
    failedSources: loaded ? failedSources : [],
    availableProducts: [...new Map(ready.catalog.items.map((item) => [item.productId, { id: item.productId, label: item.productName }])).values()],
  }
}
