import { describe, expect, it } from "vitest"

import { formatPriceForInput, MAX_PRICE, parseLocalePrice } from "@/lib/parseLocalePrice"

describe("parseLocalePrice", () => {
  it.each([
    ["12,5", 12.5],
    ["12,50", 12.5],
    ["1.234,56", 1234.56],
    ["1.234", 1234],
    ["12.5", 12.5],
    ["45", 45],
    ["R$ 45,00", 45],
    [" 0,5 ", 0.5],
    ["1.000.000", 1_000_000],
  ])("parses %s", (input, expected) => {
    expect(parseLocalePrice(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    ["", "required"],
    ["   ", "required"],
    ["abc", "invalid"],
    ["12,5,0", "invalid"],
    ["12,555", "invalid"],
    ["12.34.5", "invalid"],
    ["1.23,4", "invalid"],
    ["NaN", "invalid"],
    ["0", "notPositive"],
    ["0,00", "notPositive"],
    ["-5", "notPositive"],
    [String(MAX_PRICE + 1), "tooLarge"],
    ["99999999", "tooLarge"],
  ])("rejects %s as %s", (input, error) => {
    expect(parseLocalePrice(input)).toEqual({ ok: false, error })
  })

  it("never turns 12,5 into 125", () => {
    const result = parseLocalePrice("12,5")
    expect(result.ok && result.value).toBe(12.5)
  })

  it("formats stored values for editing", () => {
    expect(formatPriceForInput(12.5)).toBe("12,50")
    expect(formatPriceForInput(0)).toBe("")
    expect(formatPriceForInput(Number.NaN)).toBe("")
  })
})
