import { describe, expect, it } from "vitest"

import {
  bookingPolicySchema,
  bookingPolicyToFormValues,
  createBookingPolicyFormSchema,
  parseDailyLimitInput,
  toBookingPolicyReplaceBody,
} from "@/features/rentals/schemas/bookingPolicySchemas"

const schema = createBookingPolicyFormSchema({
  textMax: "text-max",
  limitRange: "limit-range",
})

describe("bookingPolicySchema", () => {
  it("accepts null text and a null daily limit", () => {
    const parsed = bookingPolicySchema.safeParse({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })

    expect(parsed.success).toBe(true)
  })

  it("accepts text and a limit inside 1..100", () => {
    const parsed = bookingPolicySchema.safeParse({
      cancellationPolicyText: "Bring a document.",
      maxActiveReservationsPerCustomerPerDay: 100,
    })

    expect(parsed.success).toBe(true)
  })

  it("reads the tenant booking horizon and leaves it off the replace body", () => {
    const parsed = bookingPolicySchema.safeParse({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 365,
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(parsed.data.maxAdvanceBookingDays).toBe(365)
    expect(
      bookingPolicySchema.safeParse({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: null,
      }).success,
    ).toBe(true)
    const missing = bookingPolicySchema.safeParse({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
    expect(missing.success).toBe(true)
    if (missing.success) {
      expect(missing.data.maxAdvanceBookingDays).toBeUndefined()
    }
    expect(
      bookingPolicySchema.safeParse({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: 3651,
      }).success,
    ).toBe(false)
  })

  it("rejects a limit outside 1..100", () => {
    expect(
      bookingPolicySchema.safeParse({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: 0,
      }).success,
    ).toBe(false)
    expect(
      bookingPolicySchema.safeParse({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: 101,
      }).success,
    ).toBe(false)
  })
})

describe("booking policy form", () => {
  it("treats blank text and a disabled limit as a full clear", () => {
    const values = {
      cancellationPolicyText: "   \n  ",
      dailyLimitEnabled: false,
      dailyLimit: "4",
    }

    expect(schema.safeParse(values).success).toBe(true)
    expect(toBookingPolicyReplaceBody(values)).toEqual({
      cancellationPolicyText: null,
      maxActiveReservationsPerCustomerPerDay: null,
    })
  })

  it("keeps plain text, including markup characters, and the daily limit", () => {
    const values = {
      cancellationPolicyText: "  <b>Bring a document.</b>\nLine 2  ",
      dailyLimitEnabled: true,
      dailyLimit: " 2 ",
    }

    expect(schema.safeParse(values).success).toBe(true)
    expect(toBookingPolicyReplaceBody(values)).toEqual({
      cancellationPolicyText: "<b>Bring a document.</b>\nLine 2",
      maxActiveReservationsPerCustomerPerDay: 2,
    })
  })

  it("rejects an empty, fractional, or out-of-range limit when the cap is on", () => {
    for (const dailyLimit of ["", "1.5", "0", "101", "abc"]) {
      expect(
        schema.safeParse({
          cancellationPolicyText: "",
          dailyLimitEnabled: true,
          dailyLimit,
        }).success,
      ).toBe(false)
    }
  })

  it("rejects text longer than 2000 characters", () => {
    expect(
      schema.safeParse({
        cancellationPolicyText: "a".repeat(2001),
        dailyLimitEnabled: false,
        dailyLimit: "",
      }).success,
    ).toBe(false)
  })

  it("maps a stored policy into form values", () => {
    expect(
      bookingPolicyToFormValues({
        cancellationPolicyText: "Hello",
        maxActiveReservationsPerCustomerPerDay: 3,
      }),
    ).toEqual({
      cancellationPolicyText: "Hello",
      dailyLimitEnabled: true,
      dailyLimit: "3",
    })
    expect(
      bookingPolicyToFormValues({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
      }),
    ).toEqual({
      cancellationPolicyText: "",
      dailyLimitEnabled: false,
      dailyLimit: "",
    })
  })

  it("parses only integers from 1 to 100", () => {
    expect(parseDailyLimitInput("1")).toBe(1)
    expect(parseDailyLimitInput("100")).toBe(100)
    expect(parseDailyLimitInput("08")).toBe(8)
    expect(parseDailyLimitInput("0")).toBeNull()
    expect(parseDailyLimitInput("101")).toBeNull()
  })
})
