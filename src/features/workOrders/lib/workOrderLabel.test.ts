import { describe, expect, it } from "vitest"

import { formatWorkOrderShortId, formatWorkOrderTitle } from "./workOrderLabel"

const id = "99999999-9999-4999-8999-999999999999"

describe("formatWorkOrderTitle", () => {
  it("uses the OS number and the asset name", () => {
    expect(formatWorkOrderTitle({ id, number: 12, asset: { name: "Split sala 1" } })).toBe("OS #12 · Split sala 1")
  })

  it("falls back to the short id when the number is missing", () => {
    const short = formatWorkOrderShortId(id)
    expect(formatWorkOrderTitle({ id, asset: { name: "Split sala 1" } })).toBe(`OS ${short} · Split sala 1`)
    expect(formatWorkOrderTitle({ id, number: null, asset: { name: "Split sala 1" } })).toBe(`OS ${short} · Split sala 1`)
  })

  it("accepts a localized prefix", () => {
    expect(formatWorkOrderTitle({ id, number: 3, asset: { name: "A" } }, "WO")).toBe("WO #3 · A")
  })
})
