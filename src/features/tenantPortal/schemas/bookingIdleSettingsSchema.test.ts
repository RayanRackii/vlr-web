import { describe, expect, it } from "vitest"

import { bookingIdleRedirectPathSchema } from "./bookingIdleSettingsSchema"

describe("bookingIdleRedirectPathSchema", () => {
  it.each([199, 200])("accepts a path with %i characters", (length) => {
    expect(bookingIdleRedirectPathSchema.safeParse("/" + "a".repeat(length - 1)).success).toBe(true)
  })

  it("rejects a path with 201 characters", () => {
    expect(bookingIdleRedirectPathSchema.safeParse("/" + "a".repeat(200)).success).toBe(false)
  })

  it.each(Array.from({ length: 65 }, (_, index) => index < 32 ? index : index + 95))(
    "rejects control character U+%i", (code) => {
      expect(bookingIdleRedirectPathSchema.safeParse(`/app${String.fromCharCode(code)}end`).success).toBe(false)
    },
  )

  it.each([0x20, 0x7e, 0xa0, 0xa1])("checks characters adjacent to the control ranges: U+%i", (code) => {
    const character = String.fromCharCode(code)
    expect(bookingIdleRedirectPathSchema.safeParse(`/app${character}`).success).toBe(!/\s/.test(character))
  })
})
