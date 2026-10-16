import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { fetchAdminScheduleDay } from "@/features/rentals/services/scheduleService"

const apiGet = vi.mocked(api.get)
const ASSET_ID = "11111111-1111-4111-8111-111111111111"

describe("fetchAdminScheduleDay", () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it("asks the browser not to reuse a cached day", async () => {
    apiGet.mockResolvedValue({
      data: {
        date: "2026-10-08",
        slots: [
          {
            id: "61111111-1111-4111-8111-111111111111",
            rentalAssetId: ASSET_ID,
            assetName: "Sala 1",
            date: "2026-10-08",
            startTime: "12:00:00",
            endTime: "13:00:00",
            occupancyKindId: "51111111-1111-4111-8111-111111111111",
            occupancyKindKey: "lesson",
            occupancyKindLabel: "Aula",
            isBookableByCustomer: true,
            status: "Available",
            isDerived: true,
            source: "WeeklyDefault",
            schedulePolicy: "SlotGrid",
            supportsEntireRecurrence: false,
          },
        ],
      },
    })

    await fetchAdminScheduleDay("2026-10-08", [ASSET_ID])

    expect(apiGet).toHaveBeenCalledWith(
      `/api/schedule/days/2026-10-08?rentalAssetIds=${ASSET_ID}`,
      {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
    )
  })
})
