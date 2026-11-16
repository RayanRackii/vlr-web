import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { formatLateDuration, lateDuration } from "@/lib/lateDuration"

describe("lateDuration", () => {
  it.each([
    [0, "minutes", 1],
    [40, "minutes", 40],
    [59, "minutes", 59],
    [60, "hours", 1],
    [185, "hours", 3],
    [1439, "hours", 23],
    [1440, "days", 1],
    [2380, "days", 1],
    [3160, "days", 2],
    [-5, "minutes", 1],
    [Number.NaN, "minutes", 1],
  ])("%s min -> %s %s", (minutes, unit, count) => {
    expect(lateDuration(minutes)).toEqual({ unit, count })
  })

  it("formats pt-BR with plural forms", () => {
    const t = i18n.t.bind(i18n)
    expect(formatLateDuration(t, 3160)).toBe("2 dias")
    expect(formatLateDuration(t, 1500)).toBe("1 dia")
    expect(formatLateDuration(t, 185)).toBe("3 h")
    expect(formatLateDuration(t, 40)).toBe("40 min")
  })
})
