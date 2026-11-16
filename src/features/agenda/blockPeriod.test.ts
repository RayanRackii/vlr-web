import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyDailyOccurrence, fetchAdminScheduleDay, upsertSlot } from "@/features/rentals/services/scheduleService"
import { asset, slot } from "./agendaFixtures"
import { blockingKinds, blockPeriod } from "./blockPeriod"

vi.mock("@/features/rentals/services/scheduleService", () => ({
  fetchAdminScheduleDay: vi.fn(),
  applyDailyOccurrence: vi.fn(),
  upsertSlot: vi.fn(),
  rentalAssetSchema: { parse: (value: unknown) => value },
}))

const input = { rentalAssetId: asset.id, date: "2026-11-10", start: "14:00", end: "18:00", kindId: "kind-block", note: " Manutenção " }
const at = (id: string, startTime: string, endTime: string, patch = {}) => slot({ id, startTime, endTime, ...patch })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(applyDailyOccurrence).mockResolvedValue(slot())
  vi.mocked(upsertSlot).mockResolvedValue(slot())
})

describe("blockPeriod", () => {
  it("updates each overlapping non-booked slot in place and skips booked ones", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: input.date, slots: [
      at("a", "13:00:00", "14:00:00"), // ends at the range start: not overlapping
      at("b", "14:00:00", "15:00:00"),
      at("c", "15:00:00", "16:00:00", { status: "Booked", reservationId: "00000000-0000-4000-8000-000000000001" }),
      at("d", "17:00:00", "18:00:00"),
      at("e", "17:00:00", "18:00:00", { rentalAssetId: "other" }),
    ] })
    const result = await blockPeriod(input)
    expect(result).toEqual({ blocked: 2, skipped: ["15:00–16:00"], failed: [] })
    expect(applyDailyOccurrence).toHaveBeenCalledTimes(2)
    expect(applyDailyOccurrence).toHaveBeenNthCalledWith(1, { slotId: "b", rentalAssetId: asset.id, date: input.date, startTime: "14:00:00", endTime: "15:00:00", action: "Update", scope: "OnlyThisDay", occupancyKindId: "kind-block", label: "Manutenção" })
    expect(upsertSlot).not.toHaveBeenCalled()
  })

  it("creates one slot for the exact range when the resource has none there", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: input.date, slots: [] })
    const result = await blockPeriod({ ...input, note: "" })
    expect(result.blocked).toBe(1)
    expect(upsertSlot).toHaveBeenCalledWith({ rentalAssetId: asset.id, date: input.date, startTime: "14:00", endTime: "18:00", occupancyKindId: "kind-block", label: null })
    expect(applyDailyOccurrence).not.toHaveBeenCalled()
  })

  it("treats a slot ending at midnight as ending at 24:00", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: input.date, slots: [at("n", "22:00:00", "00:00:00")] })
    const result = await blockPeriod({ ...input, start: "23:00", end: "23:59" })
    expect(result).toEqual({ blocked: 1, skipped: [], failed: [] })
    expect(applyDailyOccurrence).toHaveBeenCalledWith(expect.objectContaining({ slotId: "n", startTime: "22:00:00", endTime: "00:00:00" }))
    expect(upsertSlot).not.toHaveBeenCalled()
  })

  it("accepts an end of 24:00 and a midnight end", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: input.date, slots: [at("n", "22:00:00", "24:00:00")] })
    expect((await blockPeriod({ ...input, start: "23:00", end: "24:00" })).blocked).toBe(1)
    expect((await blockPeriod({ ...input, start: "23:00", end: "00:00" })).blocked).toBe(1)
    expect(upsertSlot).not.toHaveBeenCalled()
  })

  it("sends 23:59:59 to upsertSlot for a range ending at midnight with no slots", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: input.date, slots: [] })
    await blockPeriod({ ...input, start: "22:00", end: "00:00" })
    expect(upsertSlot).toHaveBeenCalledWith(expect.objectContaining({ startTime: "22:00", endTime: "23:59:59" }))
  })

  it("keeps going when one slot fails and reports it", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: input.date, slots: [at("b", "14:00:00", "15:00:00"), at("d", "17:00:00", "18:00:00")] })
    vi.mocked(applyDailyOccurrence).mockRejectedValueOnce(new Error("boom"))
    const result = await blockPeriod(input)
    expect(result).toEqual({ blocked: 1, skipped: [], failed: [{ range: "14:00–15:00", message: "boom" }] })
  })
})

describe("blockingKinds", () => {
  it("keeps only active kinds that block capacity and are not customer-bookable", () => {
    const kind = (id: string, patch = {}) => ({ id, key: id, label: id, isBookableByCustomer: false, blocksCapacity: true, sortOrder: 0, isActive: true, ...patch })
    const kinds = [kind("closed"), kind("open", { isBookableByCustomer: true, blocksCapacity: false }), kind("lesson", { isBookableByCustomer: true }), kind("free", { blocksCapacity: false }), kind("old", { isActive: false })]
    expect(blockingKinds(kinds).map((item) => item.id)).toEqual(["closed"])
  })
})
