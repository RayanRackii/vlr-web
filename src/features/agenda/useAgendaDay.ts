import { useEffect, useState } from "react"
import { addCivilDays, startOfCivilWeek } from "@/features/catalog/components/agenda/agendaLayout"
import { listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import {
  fetchAdminScheduleDay,
  listAdminRentalAssets,
  listOccupancyKinds,
  type AdminDaySlot,
} from "@/features/rentals/services/scheduleService"
import { tenantCivilInstant } from "@/lib/tenantTimeZone"
import { buildAgendaDay, buildAgendaWeek, type AgendaDaySources } from "./dayGridModel"
import type { AgendaState } from "./urlState"

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

export const agendaSourceIds = ["assets", "orders", "reservations", "schedule"] as const
export type AgendaSourceId = (typeof agendaSourceIds)[number]

/**
 * Staff day occupancy for `/agenda`. Work orders are not loaded: the list API
 * has an asset and a date, not a rental asset or a start and end.
 */
export function useAgendaDay(state: AgendaState, zone: string, access: AgendaAccess, tenantId: string | null, enabled: boolean) {
  const [sources, setSources] = useState<AgendaDaySources>(emptySources)
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
    ] as const

    void Promise.allSettled(pending).then((results) => {
      if (!active) return
      const [assets, catalog, reservations, schedule, kinds] = results
      const scheduleValue = schedule.status === "fulfilled" ? schedule.value : { slots: [], failed: true }
      const failed: AgendaSourceId[] = []
      if (assets.status === "rejected") failed.push("assets")
      if (catalog.status === "rejected") failed.push("orders")
      if (reservations.status === "rejected") failed.push("reservations")
      if (schedule.status === "rejected" || scheduleValue.failed || kinds.status === "rejected") failed.push("schedule")
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

  const ready = canLoad && loadedKey === requestKey ? sources : emptySources()
  return {
    loading: canLoad && loadedKey !== requestKey,
    failedSources: canLoad && loadedKey === requestKey ? failedSources : [],
    day: buildAgendaDay(ready, state, zone),
    week: buildAgendaWeek(ready, state, zone),
  }
}
