import { describe, expect, it } from "vitest"
import { buildAgendaDay, buildAgendaWeek } from "./dayGridModel"
import { parseAgendaState } from "./urlState"
import { asset, order, slot, sources } from "./agendaFixtures"

const state = (search = "") => parseAgendaState(new URLSearchParams(search), "2026-11-10")

describe("staff day occupancy model", () => {
  it("merges catalog and internal-use slots into one pedido, preserving product/order and work times", () => {
    const day = buildAgendaDay(sources({ catalog: { resources: [], items: [order] }, slots: [slot({ isInternalUseOrigin: true, owningCatalogOrderId: order.orderId })] }), state(), "America/Sao_Paulo")
    expect(day.rows[0].blocks).toHaveLength(1)
    expect(day.rows[0].blocks[0]).toMatchObject({ kind: "pedido", orderId: order.orderId, productId: order.productId, start: 540, end: 720, workStart: order.workStart, workEnd: order.workEnd })
    expect(day.start).toBe(360)
    expect(day.end).toBe(1380)
  })
})

it("deduplicates booked reservation slots and ignores availability/lessons and cancelled reservations", () => {
  const reservation = { id: "reservation", tenantId: "tenant", unitId: "unit", customerId: "customer", customerName: "Marina", customerWhatsApp: "", startDateTime: "2026-11-10T15:00:00Z", endDateTime: "2026-11-10T17:00:00Z", status: "Confirmed" as const, totalAmount: 0, depositPaid: 0, createdAt: "2026-11-10T00:00:00Z", items: [{ id: "item", assetId: asset.assetId, rentalAssetId: asset.id, assetName: asset.name, quantity: 1, unitPrice: 0, subTotal: 0 }] }
  const day = buildAgendaDay(sources({ reservations: [reservation, { ...reservation, id: "cancelled", status: "Canceled" }], slots: [slot({ status: "Booked", reservationId: "reservation", occupancyKindKey: "open", startTime: "12:00:00", endTime: "14:00:00" }), slot({ id: "open", occupancyKindKey: "open" }), slot({ id: "lesson", occupancyKindKey: "lesson" }), slot({ id: "maintenance", occupancyKindKey: "maintenance" }), slot({ id: "closed", occupancyKindKey: "closed" })] }), state(), "America/Sao_Paulo")
  expect(day.rows[0].blocks.map((b) => b.kind)).toEqual(["reserva", "manutencao", "bloqueio"])
  expect(day.rows[0].blocks[0]).toMatchObject({ start: 720, end: 840, customerName: "Marina" })
})

it("applies category, product, order and type filters while retaining empty resource rows", () => {
  const data = sources({ assets: [asset, { ...asset, id: "other", name: "Estúdio B", categoryId: "other-category" }], catalog: { resources: [], items: [order] }, slots: [slot({ id: "maintenance", occupancyKindKey: "manutencao" })] })
  expect(buildAgendaDay(data, state(`recurso=${asset.categoryId}&produto=other`), "America/Sao_Paulo").rows).toMatchObject([{ id: asset.id, blocks: [{ kind: "manutencao" }] }])
  expect(buildAgendaDay(data, state(`pedido=other&tipo=pedido`), "America/Sao_Paulo").rows.map((r) => r.blocks.length)).toEqual([0, 0])
  expect(buildAgendaDay(data, state(`produto=${order.productId}&pedido=${order.orderId}&tipo=pedido`), "America/Sao_Paulo").rows[0].blocks).toHaveLength(1)
})

it("clips overnight instants in the tenant timezone and derives hours from slots when the roster has none", () => {
  const day = buildAgendaDay(sources({ assets: [{ ...asset, openTime: null, closeTime: null }], catalog: { resources: [], items: [{ ...order, occupiedStart: "2026-11-11T01:00:00Z", occupiedEnd: "2026-11-11T04:00:00Z" }] }, slots: [slot({ startTime: "05:30:00", endTime: "07:00:00", occupancyKindKey: "open" })] }), state(), "America/Sao_Paulo")
  expect(day.rows[0].blocks[0]).toMatchObject({ start: 1320, end: 1440 })
  expect(day.start).toBe(300)
  expect(day.end).toBe(1440)
})

it("counts each kind on the civil days of the week that contains the date", () => {
  const week = buildAgendaWeek(sources({ catalog: { resources: [], items: [order] } }), state("visao=semana&date=2026-11-10"), "America/Sao_Paulo")
  expect(week.days).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"])
  const tuesday = week.rows[0].cells.find((cell) => cell.date === "2026-11-10")
  const monday = week.rows[0].cells.find((cell) => cell.date === "2026-11-09")
  expect(tuesday?.counts.pedido).toBe(1)
  expect(monday?.counts).toEqual({ reserva: 0, pedido: 0, manutencao: 0, bloqueio: 0 })
})

it("copies the order onto a slot block instead of keeping the raw slot label", () => {
  const untitled = { ...order, occupiedStart: null, occupiedEnd: null, workStart: null, workEnd: null, productName: "Podcast", orderStatus: "Approved" as const }
  const day = buildAgendaDay(sources({
    catalog: { resources: [], items: [untitled] },
    slots: [slot({ isInternalUseOrigin: true, owningCatalogOrderId: order.orderId, occupancyKindKey: "open", occupancyKindLabel: "Open", label: "Open" })],
  }), state(), "America/Sao_Paulo")
  expect(day.rows[0].blocks).toHaveLength(1)
  expect(day.rows[0].blocks[0]).toMatchObject({ kind: "pedido", productName: "Podcast", orderStatus: "Approved", label: null })
})

it("filters by selected resource ids and by free time", () => {
  const busy = { ...asset, id: "busy", name: "Estúdio B", openTime: "09:00:00", closeTime: "12:00:00" }
  const data = sources({ assets: [asset, busy], slots: [slot({ id: "all-day", rentalAssetId: "busy", startTime: "09:00:00", endTime: "12:00:00", occupancyKindKey: "maintenance" })] })
  expect(buildAgendaDay(data, state("recursos=busy"), "America/Sao_Paulo").rows.map((r) => r.id)).toEqual(["busy"])
  expect(buildAgendaDay(data, state(`recursos=${asset.id},busy`), "America/Sao_Paulo").rows.map((r) => r.id)).toEqual([asset.id, "busy"])
  expect(buildAgendaDay(data, state("livres=1"), "America/Sao_Paulo").rows.map((r) => r.id)).toEqual([asset.id])
  // A tipo filter must not change what counts as free time.
  expect(buildAgendaDay(data, state("livres=1&tipo=reserva"), "America/Sao_Paulo").rows.map((r) => r.id)).toEqual([asset.id])
})
