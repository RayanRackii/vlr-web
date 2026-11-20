import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { listCatalogOrders, listCatalogProductAgenda, listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import { fetchAdminScheduleDay, listAdminRentalAssets, listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { invalidateCurrentUserCache } from "@/features/users/services/currentUserCache"
import { createTestQueryClient } from "@/test/renderWithQuery"
import { asset, order } from "./agendaFixtures"
import { useAgendaDay } from "./useAgendaDay"
import { parseAgendaState } from "./urlState"

vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogProducts: vi.fn(),
  listCatalogOrders: vi.fn(),
  listCatalogResourceAgenda: vi.fn(),
  listCatalogProductAgenda: vi.fn(),
}))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()),
  listAdminRentalAssets: vi.fn(),
  fetchAdminScheduleDay: vi.fn(),
  listOccupancyKinds: vi.fn(),
}))
vi.mock("@/features/rentals/services/reservationsService", () => ({ listAdminReservations: vi.fn() }))

const zone = "America/Sao_Paulo"
const access = { assets: true, schedule: true, reservations: true, orders: true }
const day = parseAgendaState(new URLSearchParams("?visao=dia&date=2026-11-10"), "2026-11-10")
const week = parseAgendaState(new URLSearchParams("?visao=semana&date=2026-11-10"), "2026-11-10")

function setup(initial = day, tenantId: string | null = "t1", client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = renderHook((props: { state: typeof day; tenantId: string | null }) => useAgendaDay(props.state, zone, access, props.tenantId, true), { wrapper, initialProps: { state: initial, tenantId } })
  return { ...hook, client }
}
const requestCount = () => [listAdminRentalAssets, listOccupancyKinds, listCatalogResourceAgenda, listAdminReservations, listCatalogOrders, fetchAdminScheduleDay]
  .reduce((sum, fn) => sum + vi.mocked(fn).mock.calls.length, 0)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listAdminRentalAssets).mockResolvedValue([asset])
  vi.mocked(listOccupancyKinds).mockResolvedValue([])
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [order] })
  vi.mocked(listAdminReservations).mockResolvedValue([])
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: "2026-11-10", slots: [] })
  vi.mocked(listCatalogOrders).mockResolvedValue([])
  vi.mocked(listCatalogProductAgenda).mockResolvedValue([])
})

describe("useAgendaDay queries", () => {
  it("requests orders once, without a date range (the API filters by creation date), with an abort signal", async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listCatalogOrders).toHaveBeenCalledTimes(1)
    const [query, options] = vi.mocked(listCatalogOrders).mock.calls[0]!
    expect(query).toBeUndefined()
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })

  it("does not call the rentals-only resource agenda when rentals access is off", async () => {
    const client = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const catalogOnly = { assets: false, schedule: false, reservations: false, orders: true }
    const { result } = renderHook(() => useAgendaDay(day, zone, catalogOnly, "t1", true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listCatalogResourceAgenda).not.toHaveBeenCalled()
    expect(result.current.failedSources).toEqual([])
  })

  it("shows planning-only order allocations from the product agenda when rentals is off", async () => {
    const planningOnly = { ...order, rentalAssetId: null, assetId: "55555555-5555-4555-8555-555555555555", resourceName: "Impressora 3D" }
    vi.mocked(listCatalogProductAgenda).mockResolvedValue([planningOnly])
    const client = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const catalogOnly = { assets: false, schedule: false, reservations: false, orders: true }
    const { result } = renderHook(() => useAgendaDay(day, zone, catalogOnly, "t1", true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listCatalogProductAgenda).toHaveBeenCalledTimes(1)
    expect(listCatalogResourceAgenda).not.toHaveBeenCalled()
    expect(listAdminRentalAssets).not.toHaveBeenCalled()
    const rows = result.current.day.rows
    expect(rows.map((row) => row.name)).toEqual(["Impressora 3D"])
    expect(rows[0].blocks).toHaveLength(1)
  })

  it("labels a block with an order created outside the visible range", async () => {
    // Created long before the service date; the label still resolves because orders are not range-filtered.
    vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [{ ...order, customerName: "", displayNumber: "" }] })
    vi.mocked(listCatalogOrders).mockResolvedValue([{ id: order.orderId, displayNumber: "#42", customerName: "Ana Antiga", createdAt: "2026-01-02T12:00:00Z" } as never])
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    const blocks = result.current.day.rows.flatMap((row) => row.blocks)
    expect(JSON.stringify(blocks)).toContain("Ana Antiga")
  })

  it("counts the requests of a day view and then a week view", async () => {
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(requestCount()).toBe(6) // assets, kinds, resource agenda, reservations, orders (once), 1 schedule day
    rerender({ state: week, tenantId: "t1" })
    await waitFor(() => expect(result.current.loading).toBe(false))
    // assets, kinds and orders (no range) reused; resource agenda, reservations and the 6 schedule days not yet cached
    expect(requestCount()).toBe(6 + 2 + 6)
    expect(listCatalogOrders).toHaveBeenCalledTimes(1)
  })

  it("reuses the cache going day, week and back to day", async () => {
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ state: week, tenantId: "t1" })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = requestCount()
    rerender({ state: day, tenantId: "t1" })
    expect(result.current.loading).toBe(false)
    expect(result.current.day.rows.length).toBeGreaterThan(0)
    expect(requestCount()).toBe(before)
  })

  it("reports only the failed source and still renders the others", async () => {
    vi.mocked(listAdminReservations).mockRejectedValue(new Error("falhou"))
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.failedSources).toEqual(["reservations"])
    expect(result.current.day.rows.map((row) => row.name)).toContain(asset.name)
  })

  it("aborts in-flight requests on unmount", async () => {
    vi.mocked(listCatalogOrders).mockImplementation(() => new Promise(() => undefined))
    const { unmount } = setup()
    await waitFor(() => expect(listCatalogOrders).toHaveBeenCalled())
    const signal = vi.mocked(listCatalogOrders).mock.calls[0]![1]!.signal!
    expect(signal.aborted).toBe(false)
    unmount()
    await waitFor(() => expect(signal.aborted).toBe(true))
  })

  it("keeps agenda data on a forced profile refresh with the same tenant", async () => {
    const { result } = setup(day, "t1")
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = requestCount()
    invalidateCurrentUserCache() // getCurrentUser({ force: true })
    expect(result.current.loading).toBe(false)
    expect(result.current.day.rows.length).toBeGreaterThan(0)
    expect(requestCount()).toBe(before)
  })

  it("never serves cached data of the previous tenant after a tenant switch", async () => {
    vi.mocked(listAdminRentalAssets).mockResolvedValueOnce([{ ...asset, name: "Recurso do tenant A" }])
    const { result, rerender, client } = setup(day, "tenantA")
    await waitFor(() => expect(result.current.day.rows.map((row) => row.name)).toContain("Recurso do tenant A"))
    vi.mocked(listAdminRentalAssets).mockResolvedValueOnce([{ ...asset, name: "Recurso do tenant B" }])
    invalidateCurrentUserCache() // what a tenant switch does (refreshAuthSession)
    client.clear()
    rerender({ state: day, tenantId: "tenantB" })
    await waitFor(() => expect(result.current.day.rows.map((row) => row.name)).toContain("Recurso do tenant B"))
    expect(result.current.day.rows.map((row) => row.name)).not.toContain("Recurso do tenant A")
    expect(client.getQueryCache().getAll().every((query) => query.queryKey[2] === "tenantB")).toBe(true)
  })
})
