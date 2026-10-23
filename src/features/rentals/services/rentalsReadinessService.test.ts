import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
    },
  }
})

import { getRentalsReadiness } from "@/features/rentals/services/rentalsReadinessService"

const apiGet = vi.mocked(api.get)

describe("rentalsReadinessService", () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it("loads the tenant rentals setup checklist", async () => {
    apiGet.mockResolvedValue({
      data: {
        ready: false,
        items: [
          { key: "hasUnits", done: true, count: 1 },
          { key: "hasRentableAssets", done: false, count: 0 },
          { key: "hasScheduleTemplateOrRule", done: false, count: 0 },
          { key: "hasBookingPolicy", done: true },
          { key: "hasVisualOrMap", done: false, count: 0 },
        ],
      },
    })

    await expect(getRentalsReadiness()).resolves.toEqual({
      ready: false,
      items: [
        { key: "hasUnits", done: true, count: 1 },
        { key: "hasRentableAssets", done: false, count: 0 },
        { key: "hasScheduleTemplateOrRule", done: false, count: 0 },
        { key: "hasBookingPolicy", done: true },
        { key: "hasVisualOrMap", done: false, count: 0 },
      ],
    })
    expect(apiGet).toHaveBeenCalledWith("/api/rentals/readiness")
  })

  it("rejects a malformed readiness payload", async () => {
    apiGet.mockResolvedValue({
      data: { ready: false, items: [{ key: "hasUnits", done: "yes" }] },
    })

    await expect(getRentalsReadiness()).rejects.toThrow()
  })
})
