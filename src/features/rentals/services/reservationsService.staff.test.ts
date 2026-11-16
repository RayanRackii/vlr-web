import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { createStaffReservation } from "./reservationsService"

const input = { customerId: "44444444-4444-4444-8444-444444444444", date: "2026-11-10", startTime: "14:00", endTime: "15:00", items: [{ assetId: "a" }], awaitingDeposit: false }

afterEach(() => { vi.restoreAllMocks() })

describe("createStaffReservation", () => {
  it("resolves on a 2xx whose body does not match the schema", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "r1", unexpected: true } })
    await expect(createStaffReservation(input)).resolves.toEqual({ id: "r1" })
  })

  it("resolves on a 2xx with an empty body", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: null })
    await expect(createStaffReservation(input)).resolves.toEqual({})
  })
})
