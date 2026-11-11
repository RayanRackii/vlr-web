import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn() },
  }
})

import { listAdminReservations } from "@/features/rentals/services/reservationsService"

const apiGet = vi.mocked(api.get)

describe("listAdminReservations query", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockResolvedValue({ data: [] })
  })

  it("sends a civil day when the caller passes an ISO instant", async () => {
    await listAdminReservations({
      from: "2026-11-10T03:00:00.000Z",
      to: "2026-11-11T03:00:00.000Z",
    })
    expect(apiGet).toHaveBeenCalledWith("/api/reservations", {
      params: {
        from: "2026-11-10",
        to: "2026-11-11",
        status: undefined,
        assetId: undefined,
      },
    })
  })

  it("keeps a civil day and drops a value that is not a date", async () => {
    await listAdminReservations({ from: "2026-11-10", to: "tomorrow" })
    expect(apiGet).toHaveBeenCalledWith("/api/reservations", {
      params: {
        from: "2026-11-10",
        to: undefined,
        status: undefined,
        assetId: undefined,
      },
    })
  })
})
