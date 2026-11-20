import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import type { AdminDaySlot } from "@/features/rentals/services/scheduleService"
import { agendaOrderSelect, agendaQueries, agendaRange } from "./agendaQueries"
import { buildAgendaDay, buildAgendaWeek, type AgendaDaySources } from "./dayGridModel"
import { agendaTypes, type AgendaState } from "./urlState"

const emptySources = (): AgendaDaySources => ({
  assets: [],
  catalog: { resources: [], items: [] },
  reservations: [],
  slots: [],
  kinds: [],
})
const emptyCatalog = { resources: [], items: [] } as AgendaDaySources["catalog"]
const noLabels: ReturnType<typeof agendaOrderSelect.labels> = []

type AgendaAccess = {
  assets: boolean
  schedule: boolean
  reservations: boolean
  orders: boolean
}

export const agendaSourceIds = ["assets", "orders", "reservations", "schedule", "kinds"] as const
export type AgendaSourceId = (typeof agendaSourceIds)[number]

type ScheduleDays = { slots: AdminDaySlot[]; failed: boolean; pending: boolean; updatedAt: number }
// Module level so `useQueries` can memoize the combined result.
const combineScheduleDays = (results: { data?: { slots: AdminDaySlot[] }; isError: boolean; isPending: boolean; dataUpdatedAt: number }[]): ScheduleDays => ({
  slots: results.flatMap((result) => result.data?.slots ?? []),
  failed: results.some((result) => result.isError),
  pending: results.some((result) => result.isPending),
  updatedAt: Math.max(0, ...results.map((result) => result.dataUpdatedAt)),
})

/**
 * Staff day occupancy for `/agenda`. Work orders are not loaded: the list API
 * has an asset and a date, not a rental asset or a start and end.
 * Each source is its own query (tenant-scoped key), so a failed source only
 * lands in `failedSources` while the others still render.
 */
export function useAgendaDay(state: AgendaState, zone: string, access: AgendaAccess, tenantId: string | null, enabled: boolean, focusedProductId?: string | null) {
  const canLoad = enabled && (access.assets || access.schedule || access.reservations || access.orders)
  const range = agendaRange(state, zone)
  const rangeKey = [range.from, range.to, range.reservationTo].join("|")
  // `range` is rebuilt every render; its key is what identifies it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableRange = useMemo(() => range, [rangeKey])
  const on = (flag: boolean) => canLoad && flag
  // GET /api/catalog/agenda/resources needs the rentals module and rentals.schedule.read (`access.schedule`);
  // order labels only need catalog.orders.read.
  const resourceAgenda = access.orders && access.schedule
  const assets = useQuery({ ...agendaQueries.assets(tenantId), enabled: on(access.assets) })
  const kinds = useQuery({ ...agendaQueries.kinds(tenantId), enabled: on(access.schedule) })
  const catalog = useQuery({ ...agendaQueries.resourceAgenda(tenantId, stableRange), enabled: on(resourceAgenda) })
  const reservations = useQuery({ ...agendaQueries.reservations(tenantId, stableRange), enabled: on(access.reservations) })
  const orders = useQuery({ ...agendaQueries.orders(tenantId), select: agendaOrderSelect.labels, enabled: on(access.orders) })
  const schedule = useQueries({
    queries: stableRange.dates.map((date) => ({ ...agendaQueries.scheduleDay(tenantId, date), enabled: on(access.schedule) })),
    combine: combineScheduleDays,
  })

  const pending = (on(access.assets) && assets.isPending) || (on(access.schedule) && (kinds.isPending || schedule.pending))
    || (on(resourceAgenda) && catalog.isPending) || (on(access.orders) && orders.isPending) || (on(access.reservations) && reservations.isPending)
  const loaded = canLoad && !pending
  const failed: AgendaSourceId[] = []
  if (on(access.assets) && assets.isError) failed.push("assets")
  if (on(resourceAgenda) && catalog.isError) failed.push("orders")
  if (on(access.reservations) && reservations.isError) failed.push("reservations")
  if (on(access.schedule) && schedule.failed) failed.push("schedule")
  if (on(access.schedule) && kinds.isError) failed.push("kinds")
  const failedKey = failed.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const failedSources = useMemo(() => failed, [failedKey])

  const assetsData = on(access.assets) ? assets.data : undefined
  const catalogData = on(resourceAgenda) ? catalog.data : undefined
  const reservationsData = on(access.reservations) ? reservations.data : undefined
  const kindsData = on(access.schedule) ? kinds.data : undefined
  const slots = on(access.schedule) ? schedule.slots : undefined
  const none = useMemo(() => emptySources(), [])
  const sources = useMemo<AgendaDaySources>(() => ({
    assets: assetsData ?? none.assets,
    catalog: catalogData ?? emptyCatalog,
    reservations: reservationsData ?? none.reservations,
    slots: slots ?? none.slots,
    kinds: kindsData ?? none.kinds,
  }), [assetsData, catalogData, reservationsData, slots, kindsData, none])
  const ready = loaded ? sources : none
  const orderLabels = on(access.orders) ? orders.data : undefined
  const labels = useMemo(() => new Map((loaded ? (orderLabels ?? noLabels) : noLabels).map((order) => [order.id, order])), [loaded, orderLabels])
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
  // When the newest data of any source arrived (react-query `dataUpdatedAt`); null until something loaded.
  const updatedAt = Math.max(assets.dataUpdatedAt, kinds.dataUpdatedAt, catalog.dataUpdatedAt, reservations.dataUpdatedAt, orders.dataUpdatedAt, schedule.updatedAt) || null
  return {
    ...derived,
    updatedAt,
    loading: canLoad && !loaded,
    failedSources: loaded ? failedSources : [],
    availableProducts: [...new Map(ready.catalog.items.map((item) => [item.productId, { id: item.productId, label: item.productName }])).values()],
  }
}
