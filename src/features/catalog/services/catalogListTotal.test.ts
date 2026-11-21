import { describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { listCatalogOrders, listProductRequests } from "@/features/catalog/services/catalogService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import { listTotalOf } from "@/lib/listTotal"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { get: vi.fn() },
}))

describe("capped staff lists", () => {
  it.each([
    ["catalog orders", () => listCatalogOrders()],
    ["product requests", () => listProductRequests()],
    ["reservations", () => listAdminReservations()],
    ["work orders", () => getWorkOrders()],
  ])("exposes X-Total-Count for %s", async (_label, load) => {
    vi.mocked(api.get).mockResolvedValue({ data: [], headers: { "x-total-count": "812" } })
    expect(listTotalOf(await load())).toBe(812)
  })

  it("has no total when the header is absent", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [], headers: {} })
    expect(listTotalOf(await listCatalogOrders())).toBeNull()
  })
})
