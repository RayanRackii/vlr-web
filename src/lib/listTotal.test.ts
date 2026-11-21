import { describe, expect, it } from "vitest"

import { listTotalOf, parseListTotal, withListTotal } from "@/lib/listTotal"

describe("listTotal", () => {
  it("records the header total for the returned array", () => {
    const rows = [1, 2, 3]
    expect(withListTotal(rows, { "x-total-count": "1200" })).toBe(rows)
    expect(listTotalOf(rows)).toBe(1200)
  })

  it("is tolerant of missing, invalid or foreign headers", () => {
    const rows = [1]
    withListTotal(rows, {})
    expect(listTotalOf(rows)).toBeNull()
    expect(parseListTotal(undefined)).toBeNull()
    expect(parseListTotal({ "x-total-count": "abc" })).toBeNull()
    expect(parseListTotal({ "x-total-count": "-3" })).toBeNull()
    expect(parseListTotal({ get: (name: string) => (name === "x-total-count" ? "7" : undefined) })).toBe(7)
    expect(listTotalOf([1, 2])).toBeNull()
  })
})
