import type { CatalogResourceAgendaResponse } from "@/features/catalog/schemas/catalogSchemas"
import type { AdminDaySlot, AdminRentalAsset, OccupancyKind } from "@/features/rentals/services/scheduleService"
import type { AdminReservation } from "@/features/rentals/services/reservationsService"
import { addCivilDays, startOfCivilWeek, zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import type { AgendaState } from "./urlState"

export type AgendaDaySources = {
  assets: AdminRentalAsset[]
  catalog: CatalogResourceAgendaResponse
  reservations: AdminReservation[]
  slots: AdminDaySlot[]
  kinds: OccupancyKind[]
}
export type AgendaOrderLabel = {
  id: string
  displayNumber: string
  customerName: string
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
  orderStatus?: string | null
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
  /** Resource kind: a place (Location) or an item (Good). */
  resourceType?: "Location" | "Good" | null
  /** Opening hours in minutes, when the resource declares them. */
  open?: number | null
  close?: number | null
  blocks: AgendaBlock[]
}

export function clockMinutes(clock?: string | null): number | null {
  if (!clock || !/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(clock)) return null
  const [h, m] = clock.split(":").map(Number)
  return h <= 24 && m < 60 && (h < 24 || m === 0) ? h * 60 + m : null
}

export function formatClock(minutes: number): string {
  const bounded = Math.min(Math.max(minutes, 0), 24 * 60)
  if (bounded === 24 * 60) return "00:00"
  const hour = Math.floor(bounded / 60)
  const minute = bounded % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
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

function withOrderLabel(block: AgendaBlock, labels: ReadonlyMap<string, AgendaOrderLabel>): AgendaBlock {
  if (!block.orderId) return block
  const order = labels.get(block.orderId)
  if (!order) return block
  return {
    ...block,
    displayNumber: block.displayNumber?.trim() ? block.displayNumber : order.displayNumber,
    customerName: block.customerName?.trim() ? block.customerName : order.customerName,
  }
}

export function buildAgendaDay(
  data: AgendaDaySources,
  state: AgendaState,
  zone: string,
  labels: ReadonlyMap<string, AgendaOrderLabel> = new Map(),
) {
  const rows = new Map<string, AgendaRow>()
  const ensure = (id: string, name: string) => {
    if (!rows.has(id)) rows.set(id, { id, name, blocks: [] })
    return rows.get(id)!
  }
  // Availability windows of resources that declare no opening hours of their own.
  const slotHours = new Map<string, { open: number; close: number }>()
  const addHours = (resourceId: string, start: number | null, end: number | null) => {
    if (start === null || end === null) return
    const close = end <= start ? 1440 : end
    const known = slotHours.get(resourceId)
    slotHours.set(resourceId, { open: Math.min(known?.open ?? start, start), close: Math.max(known?.close ?? close, close) })
  }
  for (const asset of data.assets) {
    const open = clockMinutes(asset.openTime)
    const close = clockMinutes(asset.closeTime)
    Object.assign(ensure(asset.id, asset.name), { resourceType: asset.type, categoryId: asset.categoryId, categoryName: asset.categoryName, open, close: close !== null && open !== null && close <= open ? 1440 : close })
  }
  for (const resource of data.catalog.resources) {
    const row = ensure(resource.id, resource.name)
    row.categoryName ??= resource.category
  }
  const blocks: AgendaBlock[] = []
  const catalogByOrder = new Map(data.catalog.items.map((item) => [item.orderId, item]))
  for (const item of data.catalog.items) {
    if (!item.rentalAssetId) continue
    const start = item.occupiedStart ?? item.workStart
    const end = item.occupiedEnd ?? item.workEnd
    const window = dayWindow(start, end, state.date, zone)
    if (!window) continue
    ensure(item.rentalAssetId, item.resourceName ?? item.rentalAssetId)
    blocks.push({ key: `pedido:${item.orderId}:${item.rentalAssetId}:${start}:${end}`, resourceId: item.rentalAssetId, kind: "pedido", ...window, startInstant: start!, endInstant: end!, orderId: item.orderId, displayNumber: item.displayNumber, orderStatus: item.orderStatus, productId: item.productId, productName: item.productName, customerName: item.customerName, workStart: item.workStart, workEnd: item.workEnd })
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
    if (["open", "lesson"].includes(slot.occupancyKindKey.toLowerCase())) addHours(slot.rentalAssetId, start, end)
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
    const linked = slot.owningCatalogOrderId ? catalogByOrder.get(slot.owningCatalogOrderId) : undefined
    blocks.push({
      key: `slot:${slot.id}:${slot.rentalAssetId}:${start}:${end}`,
      resourceId: slot.rentalAssetId,
      kind,
      ...window,
      orderId: slot.owningCatalogOrderId,
      displayNumber: linked?.displayNumber,
      orderStatus: linked?.orderStatus,
      productId: linked?.productId,
      productName: linked?.productName,
      reservationId: slot.reservationId,
      customerName: slot.customerName ?? linked?.customerName,
      label: linked ? null : slot.label ?? slot.occupancyKindLabel,
      color: slot.occupancyKindColorHex,
    })
  }
  const allBlocks = new Map<string, AgendaBlock[]>()
  for (const block of blocks) {
    allBlocks.set(block.resourceId, [...(allBlocks.get(block.resourceId) ?? []), block])
    if (state.tipo && state.tipo !== block.kind) continue
    if (block.kind === "pedido" && ((state.produto && state.produto !== block.productId) || (state.pedido && state.pedido !== block.orderId))) continue
    rows.get(block.resourceId)?.blocks.push(withOrderLabel(block, labels))
  }
  for (const [id, hours] of slotHours) {
    const row = rows.get(id)
    if (row && (row.open == null || row.close == null)) Object.assign(row, { open: hours.open, close: hours.close })
  }
  // A selected id may also be a category id (legacy `recurso` links carried one).
  const picked = (row: AgendaRow) => state.recursos.includes(row.id) || (!!row.categoryId && state.recursos.includes(row.categoryId))
  // Ids that match nothing (stale links) are ignored instead of hiding every row.
  const selecting = [...rows.values()].some(picked)
  // "Free time" is judged against the opening hours, even when the grid shows 24 hours.
  const open = agendaAxis([...rows.values()], blocks, false)
  const visible = [...rows.values()].filter((row) => {
    if (selecting && !picked(row)) return false
    return !state.livres || hasFreeTime(row, allBlocks.get(row.id) ?? [], open.start, open.end)
  })
  const axis = state.fechadas ? { ...agendaAxis(visible, blocks, true), businessHours: agendaAxis(visible, blocks, false).businessHours } : agendaAxis(visible, blocks, false)
  return { rows: visible, start: axis.start, end: axis.end, businessHours: axis.businessHours }
}

export const DEFAULT_AXIS_START = 8 * 60
export const DEFAULT_AXIS_END = 20 * 60

/**
 * Hour axis of the day grid. It follows the business hours of the given resources
 * (earliest open to latest close, rounded to the hour) and is never widened by a block:
 * long blocks are clipped to it. Only when no resource declares hours does it fall back
 * to the span of the blocks, then to a default working day. `full` shows 00:00 to 24:00.
 */
export function agendaAxis(rows: AgendaRow[], blocks: AgendaBlock[], full: boolean) {
  const opens = rows.flatMap((row) => (row.open != null && row.close != null ? [row.open] : []))
  const closes = rows.flatMap((row) => (row.open != null && row.close != null ? [row.close] : []))
  const businessHours = opens.length ? { open: Math.min(...opens), close: Math.max(...closes) } : null
  if (full) return { start: 0, end: 1440, businessHours }
  let from: number
  let to: number
  if (businessHours) {
    from = businessHours.open
    to = businessHours.close
  } else {
    const own = blocks.filter((block) => rows.some((row) => row.id === block.resourceId))
    from = own.length ? Math.min(...own.map((block) => block.start)) : DEFAULT_AXIS_START
    to = own.length ? Math.max(...own.map((block) => block.end)) : DEFAULT_AXIS_END
  }
  const start = Math.floor(from / 60) * 60
  return { start, end: Math.max(start + 60, Math.ceil(to / 60) * 60), businessHours }
}

/** A block cut to the axis: where it sits and whether the edges were clipped. */
export type ClippedBlock = { start: number; end: number; clippedStart: boolean; clippedEnd: boolean; allDay: boolean }

/** Packs overlapping blocks of one row into lanes (0-based), earliest first. */
export function layoutLanes(blocks: AgendaBlock[]): { block: AgendaBlock; lane: number }[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end)
  const ends: number[] = []
  return sorted.map((block) => {
    const open = ends.findIndex((end) => end <= block.start)
    const lane = open === -1 ? ends.length : open
    ends[lane] = block.end
    return { block, lane }
  })
}

/** Null when the block lies entirely outside the axis. */
export function clipBlock(block: Pick<AgendaBlock, "start" | "end">, axisStart: number, axisEnd: number): ClippedBlock | null {
  if (block.end <= axisStart || block.start >= axisEnd) return null
  const start = Math.max(block.start, axisStart)
  const end = Math.min(block.end, axisEnd)
  return { start, end, clippedStart: block.start < axisStart, clippedEnd: block.end > axisEnd, allDay: block.start <= axisStart && block.end >= axisEnd }
}

/** True when the blocks (of every kind) leave part of the open window uncovered. */
function hasFreeTime(row: AgendaRow, blocks: AgendaBlock[], axisStart: number, axisEnd: number) {
  const open = row.open ?? axisStart
  const close = row.close ?? axisEnd
  if (open == null || close == null || close <= open) return false
  let cursor = open
  for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
    if (block.start > cursor) return true
    cursor = Math.max(cursor, block.end)
    if (cursor >= close) return false
  }
  return cursor < close
}

export type AgendaWeekCell = {
  date: string
  counts: Record<AgendaBlock["kind"], number>
}

export type AgendaWeekRow = {
  id: string
  name: string
  categoryName?: string | null
  resourceType?: AgendaRow["resourceType"]
  cells: AgendaWeekCell[]
}

/** Seven civil days starting Monday, with a count of each occupancy kind. */
export function buildAgendaWeek(
  data: AgendaDaySources,
  state: AgendaState,
  zone: string,
  labels: ReadonlyMap<string, AgendaOrderLabel> = new Map(),
) {
  const days = Array.from({ length: 7 }, (_, index) => addCivilDays(startOfCivilWeek(state.date), index))
  // "Only free" is decided once for the range: keep a resource when any day has free time, then show all its blocks.
  const byDay = days.map((date) => buildAgendaDay(data, { ...state, livres: false, visao: "dia", date }, zone, labels))
  const keep = state.livres ? new Set(days.flatMap((date) => buildAgendaDay(data, { ...state, visao: "dia", date }, zone, labels).rows.map((row) => row.id))) : null
  const rows = new Map<string, AgendaWeekRow>()
  for (const day of byDay) {
    for (const row of day.rows) {
      if (keep && !keep.has(row.id)) continue
      if (!rows.has(row.id)) {
        rows.set(row.id, {
          id: row.id,
          name: row.name,
          categoryName: row.categoryName,
          resourceType: row.resourceType,
          cells: days.map((date) => ({
            date,
            counts: { reserva: 0, pedido: 0, manutencao: 0, bloqueio: 0 },
          })),
        })
      }
    }
  }
  byDay.forEach((day, index) => {
    for (const row of day.rows) {
      if (keep && !keep.has(row.id)) continue
      const cell = rows.get(row.id)?.cells[index]
      if (!cell) continue
      for (const block of row.blocks) cell.counts[block.kind] += 1
    }
  })
  return { days, rows: [...rows.values()] }
}
