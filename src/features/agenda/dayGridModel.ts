import type { CatalogResourceAgendaResponse } from "@/features/catalog/schemas/catalogSchemas"
import type { AdminDaySlot, AdminRentalAsset, OccupancyKind } from "@/features/rentals/services/scheduleService"
import type { AdminReservation } from "@/features/rentals/services/reservationsService"
import { zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import type { AgendaState } from "./urlState"

export type AgendaDaySources = {
  assets: AdminRentalAsset[]
  catalog: CatalogResourceAgendaResponse
  reservations: AdminReservation[]
  slots: AdminDaySlot[]
  kinds: OccupancyKind[]
}
export type AgendaBlock = {
  key: string
  resourceId: string
  kind: NonNullable<AgendaState["tipo"]>
  start: number
  end: number
  startInstant?: string
  endInstant?: string
  workStart?: string | null
  workEnd?: string | null
  orderId?: string | null
  productId?: string
  productName?: string
  displayNumber?: string | null
  reservationId?: string | null
  customerName?: string | null
  label?: string | null
  color?: string | null
}
export type AgendaRow = {
  id: string
  name: string
  categoryId?: string | null
  categoryName?: string | null
  blocks: AgendaBlock[]
}

export function clockMinutes(clock?: string | null): number | null {
  if (!clock || !/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(clock)) return null
  const [h, m] = clock.split(":").map(Number)
  return h <= 24 && m < 60 && (h < 24 || m === 0) ? h * 60 + m : null
}

/** Intersect instants with the tenant's civil day, keeping overnight occupancy. */
function dayWindow(start: string | null, end: string | null, date: string, zone: string) {
  if (!start || !end || Date.parse(end) <= Date.parse(start)) return null
  const a = zonedDayAndMinutes(start, zone)
  const b = zonedDayAndMinutes(end, zone)
  if (!a || !b || a.dayKey > date || b.dayKey < date) return null
  const left = a.dayKey < date ? 0 : a.minutes
  const right = b.dayKey > date ? 1440 : b.minutes
  return right > left ? { start: left, end: right } : null
}

export function buildAgendaDay(data: AgendaDaySources, state: AgendaState, zone: string) {
  const rows = new Map<string, AgendaRow>()
  const ensure = (id: string, name: string) => {
    if (!rows.has(id)) rows.set(id, { id, name, blocks: [] })
    return rows.get(id)!
  }
  const hours: number[] = []
  const addHours = (start: number | null, end: number | null) => {
    if (start === null || end === null) return
    hours.push(start, end <= start ? 1440 : end)
  }
  for (const asset of data.assets) {
    Object.assign(ensure(asset.id, asset.name), { categoryId: asset.categoryId, categoryName: asset.categoryName })
    addHours(clockMinutes(asset.openTime), clockMinutes(asset.closeTime))
  }
  for (const resource of data.catalog.resources) {
    const row = ensure(resource.id, resource.name)
    row.categoryName ??= resource.category
  }
  const blocks: AgendaBlock[] = []
  for (const item of data.catalog.items) {
    if (!item.rentalAssetId) continue
    const start = item.occupiedStart ?? item.workStart
    const end = item.occupiedEnd ?? item.workEnd
    const window = dayWindow(start, end, state.date, zone)
    if (!window) continue
    ensure(item.rentalAssetId, item.resourceName ?? item.rentalAssetId)
    blocks.push({ key: `pedido:${item.orderId}:${item.rentalAssetId}:${start}:${end}`, resourceId: item.rentalAssetId, kind: "pedido", ...window, startInstant: start!, endInstant: end!, orderId: item.orderId, displayNumber: item.displayNumber, productId: item.productId, productName: item.productName, customerName: item.customerName, workStart: item.workStart, workEnd: item.workEnd })
  }
  for (const reservation of data.reservations) {
    if (["cancelled", "canceled"].includes(reservation.status.toLowerCase())) continue
    const window = dayWindow(reservation.startDateTime, reservation.endDateTime, state.date, zone)
    if (!window) continue
    for (const item of reservation.items) {
      ensure(item.rentalAssetId, item.assetName)
      const key = `reserva:${reservation.id}:${item.rentalAssetId}`
      if (blocks.some((block) => block.key === key)) continue
      blocks.push({ key, resourceId: item.rentalAssetId, kind: "reserva", ...window, startInstant: reservation.startDateTime, endInstant: reservation.endDateTime, reservationId: reservation.id, customerName: reservation.customerName })
    }
  }
  for (const slot of data.slots) {
    if (slot.date.slice(0, 10) !== state.date || slot.status.toLowerCase() === "cancelled") continue
    ensure(slot.rentalAssetId, slot.assetName)
    const start = clockMinutes(slot.startTime)
    const end = clockMinutes(slot.endTime)
    addHours(start, end)
    if (start === null || end === null || start === end) continue
    const window = { start, end: end < start ? 1440 : end }
    let kind: AgendaBlock["kind"]
    if (slot.isInternalUseOrigin || slot.owningCatalogOrderId) {
      if (blocks.some((b) => b.kind === "pedido" && b.resourceId === slot.rentalAssetId && (slot.owningCatalogOrderId ? b.orderId === slot.owningCatalogOrderId : b.start <= window.start && b.end >= window.end))) continue
      kind = "pedido"
    } else if (slot.reservationId && slot.status.toLowerCase() === "booked") {
      if (blocks.some((b) => b.kind === "reserva" && b.resourceId === slot.rentalAssetId && b.reservationId === slot.reservationId)) continue
      kind = "reserva"
    } else {
      const key = slot.occupancyKindKey.toLowerCase()
      if (key === "open" || key === "lesson") continue
      if (key === "maintenance" || key === "manutencao") kind = "manutencao"
      else if (key === "closed" || (!slot.isBookableByCustomer && data.kinds.some((k) => k.id === slot.occupancyKindId && k.blocksCapacity))) kind = "bloqueio"
      else continue
    }
    blocks.push({ key: `slot:${slot.id}:${slot.rentalAssetId}:${start}:${end}`, resourceId: slot.rentalAssetId, kind, ...window, orderId: slot.owningCatalogOrderId, reservationId: slot.reservationId, customerName: slot.customerName, label: slot.label ?? slot.occupancyKindLabel, color: slot.occupancyKindColorHex })
  }
  for (const block of blocks) {
    hours.push(block.start, block.end)
    if (state.tipo && state.tipo !== block.kind) continue
    if (block.kind === "pedido" && ((state.produto && state.produto !== block.productId) || (state.pedido && state.pedido !== block.orderId))) continue
    rows.get(block.resourceId)?.blocks.push(block)
  }
  return {
    rows: [...rows.values()].filter((row) => !state.recurso || row.categoryId === state.recurso),
    start: hours.length ? Math.floor(Math.min(...hours) / 60) * 60 : null,
    end: hours.length ? Math.ceil(Math.max(...hours) / 60) * 60 : null,
  }
}
