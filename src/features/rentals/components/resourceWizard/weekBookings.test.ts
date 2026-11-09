import { describe, expect, it } from "vitest"

import {
  addCivilDays,
  formatCivilDay,
  groupByCivilDate,
  mondayOfWeek,
  reservationMatchesResource,
  weekDays,
} from "@/features/rentals/components/resourceWizard/weekBookings"

describe("week bookings", () => {
  it("starts the week on Monday and shifts across month boundaries", () => {
    expect(mondayOfWeek("2026-11-11")).toBe("2026-11-09")
    expect(mondayOfWeek("2026-11-09")).toBe("2026-11-09")
    expect(weekDays("2026-11-09")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ])
    expect(addCivilDays("2026-11-30", 1)).toBe("2026-12-01")
  })

  it("keeps only reservations for this item and groups them by the tenant day", () => {
    const mine = {
      startDateTime: "2026-11-10T01:30:00.000Z",
      items: [{ rentalAssetId: "rental", assetId: "registry" }],
    }
    const other = {
      startDateTime: "2026-11-10T15:00:00.000Z",
      items: [{ rentalAssetId: "other", assetId: "other-registry" }],
    }
    expect(reservationMatchesResource(mine, "rental", "registry")).toBe(true)
    expect(reservationMatchesResource(other, "rental", "registry")).toBe(false)
    const grouped = groupByCivilDate([mine], "America/Sao_Paulo")
    expect([...grouped.keys()]).toEqual(["2026-11-09"])
  })

  it("formats a civil day without shifting it into the previous UTC date", () => {
    expect(formatCivilDay("2026-11-09", "pt-BR")).toContain("09")
    expect(formatCivilDay("2026-11-09", "pt-BR")).toContain("11")
  })
})
