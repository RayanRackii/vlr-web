import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { createStaffReservation, updateReservationNotes } from "./reservationsService"

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

describe("updateReservationNotes", () => {
  const body = { id: "11111111-1111-4111-8111-111111111111", tenantId: "11111111-1111-4111-8111-111111111112", unitId: "11111111-1111-4111-8111-111111111113", customerId: "11111111-1111-4111-8111-111111111114", customerName: "Ana", customerWhatsApp: "", startDateTime: "x", endDateTime: "y", status: "Confirmed", totalAmount: 0, depositPaid: 0, createdAt: "z", notes: "Levar rede", items: [] }

  it("PUTs the trimmed note and returns the reservation", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: body })
    const result = await updateReservationNotes(body.id, "  Levar rede ")
    expect(put).toHaveBeenCalledWith(`/api/reservations/${body.id}/notes`, { notes: "Levar rede" })
    expect(result.notes).toBe("Levar rede")
  })

  it("sends null to clear the note", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { ...body, notes: null } })
    await updateReservationNotes(body.id, "   ")
    expect(put).toHaveBeenCalledWith(`/api/reservations/${body.id}/notes`, { notes: null })
  })

  it("passes the note through createStaffReservation", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null })
    await createStaffReservation({ ...input, notes: "N" })
    expect(post).toHaveBeenCalledWith("/api/reservations/staff", expect.objectContaining({ notes: "N" }))
  })
})
