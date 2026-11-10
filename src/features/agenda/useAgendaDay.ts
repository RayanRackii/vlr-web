import { useEffect, useState } from "react"
import { addCivilDays } from "@/features/catalog/components/agenda/agendaLayout"
import { listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import {
  fetchAdminScheduleDay,
  listAdminRentalAssets,
  listOccupancyKinds,
} from "@/features/rentals/services/scheduleService"
import { tenantCivilInstant } from "@/lib/tenantTimeZone"
import { buildAgendaDay, type AgendaDaySources } from "./dayGridModel"
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

/**
 * Staff day occupancy for `/agenda`. Work orders are not loaded: the list API
 * has an asset and a date, not a rental asset or a start and end.
 */
export function useAgendaDay(state: AgendaState, zone: string, access: AgendaAccess, tenantId: string | null, enabled: boolean) {
  const [sources, setSources] = useState<AgendaDaySources>(emptySources)
  const [error, setError] = useState(false)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const canLoad = enabled && (access.assets || access.schedule || access.reservations || access.orders)
  const requestKey = [
    state.date,
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
    const from = tenantCivilInstant(state.date, "00:00:00", zone).toISOString()
    const to = tenantCivilInstant(addCivilDays(state.date, 1), "00:00:00", zone).toISOString()
    const pending = [
      access.assets ? listAdminRentalAssets() : Promise.resolve([]),
      access.orders ? listCatalogResourceAgenda({ from, to }) : Promise.resolve({ resources: [], items: [] }),
      access.reservations ? listAdminReservations({ from, to }) : Promise.resolve([]),
      access.schedule ? fetchAdminScheduleDay(state.date) : Promise.resolve({ date: state.date, slots: [] }),
      access.schedule ? listOccupancyKinds() : Promise.resolve([]),
    ] as const

    void Promise.allSettled(pending).then((results) => {
      if (!active) return
      const [assets, catalog, reservations, schedule, kinds] = results
      setError(results.some((result) => result.status === "rejected"))
      setSources({
        assets: assets.status === "fulfilled" ? assets.value : [],
        catalog: catalog.status === "fulfilled" ? catalog.value : { resources: [], items: [] },
        reservations: reservations.status === "fulfilled" ? reservations.value : [],
        slots: schedule.status === "fulfilled" ? schedule.value.slots : [],
        kinds: kinds.status === "fulfilled" ? kinds.value : [],
      })
      setLoadedKey(requestKey)
    })

    return () => {
      active = false
    }
  }, [access.assets, access.orders, access.reservations, access.schedule, canLoad, requestKey, state.date, zone])

  if (!canLoad) {
    return { loading: false, error: false, day: buildAgendaDay(emptySources(), state, zone) }
  }

  return {
    loading: loadedKey !== requestKey,
    error: loadedKey === requestKey && error,
    day: buildAgendaDay(loadedKey === requestKey ? sources : emptySources(), state, zone),
  }
}
