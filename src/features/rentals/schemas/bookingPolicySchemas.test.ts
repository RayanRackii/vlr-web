import { describe, expect, it } from "vitest"

import {
  bookingPolicySchema,
  bookingPolicyToFormValues,
  createBookingPolicyFormSchema,
  parseDailyLimitInput,
  parseHorizonDaysInput,
  resolveTenantHorizonWrite,
  toBookingPolicyReplaceBody,
} from "@/features/rentals/schemas/bookingPolicySchemas"

const schema = createBookingPolicyFormSchema({
  textMax: "text-max",
  limitRange: "limit-range",
  horizonRange: "horizon-range",
})

const untouchedHorizon = {
  horizonMode: "unlimited" as const,
  horizonDays: "",
}

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
      ...untouchedHorizon,
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
      ...untouchedHorizon,
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
          ...untouchedHorizon,
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
        ...untouchedHorizon,
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
      cancelCutoffMode: "none",
      cancelCutoffHours: "",
      cancellationPolicyText: "Hello",
      dailyLimitEnabled: true,
      dailyLimit: "3",
      horizonMode: "unlimited",
      horizonDays: "",
    })
    expect(
      bookingPolicyToFormValues({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: 14,
      }),
    ).toEqual({
      cancelCutoffMode: "none",
      cancelCutoffHours: "",
      cancellationPolicyText: "",
      dailyLimitEnabled: false,
      dailyLimit: "",
      horizonMode: "days",
      horizonDays: "14",
    })
    expect(
      bookingPolicyToFormValues({
        cancellationPolicyText: null,
        maxActiveReservationsPerCustomerPerDay: null,
        maxAdvanceBookingDays: null,
      }),
    ).toEqual({
      cancelCutoffMode: "none",
      cancelCutoffHours: "",
      cancellationPolicyText: "",
      dailyLimitEnabled: false,
      dailyLimit: "",
      ...untouchedHorizon,
    })
  })

  it("omits an unchanged horizon, sends null to clear, and sends a number to replace", () => {
    const base = {
      cancellationPolicyText: "Note",
      dailyLimitEnabled: false,
      dailyLimit: "",
    }

    expect(
      toBookingPolicyReplaceBody(
        { ...base, horizonMode: "unlimited", horizonDays: "" },
        30,
      ),
    ).toEqual({
      cancellationPolicyText: "Note",
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: null,
    })

    expect(
      toBookingPolicyReplaceBody(
        { ...base, horizonMode: "days", horizonDays: "14" },
        null,
      ),
    ).toEqual({
      cancellationPolicyText: "Note",
      maxActiveReservationsPerCustomerPerDay: null,
      maxAdvanceBookingDays: 14,
    })

    const unchanged = toBookingPolicyReplaceBody(
      { ...base, horizonMode: "days", horizonDays: "30" },
      30,
    )
    expect(unchanged).not.toHaveProperty("maxAdvanceBookingDays")

    const absentUnlimited = toBookingPolicyReplaceBody(
      { ...base, horizonMode: "unlimited", horizonDays: "8" },
      undefined,
    )
    expect(absentUnlimited).not.toHaveProperty("maxAdvanceBookingDays")

    const sameNull = toBookingPolicyReplaceBody(
      { ...base, ...untouchedHorizon },
      null,
    )
    expect(sameNull).not.toHaveProperty("maxAdvanceBookingDays")
  })

  it("rejects a horizon outside 0..3650 and accepts the ends", () => {
    expect(parseHorizonDaysInput("0")).toBe(0)
    expect(parseHorizonDaysInput("3650")).toBe(3650)
    expect(parseHorizonDaysInput("08")).toBe(8)
    expect(parseHorizonDaysInput("")).toBeNull()
    expect(parseHorizonDaysInput("-1")).toBeNull()
    expect(parseHorizonDaysInput("3651")).toBeNull()
    expect(parseHorizonDaysInput("1.5")).toBeNull()

    expect(() => resolveTenantHorizonWrite("days", "3651", null)).toThrow(
      "Booking horizon is invalid.",
    )

    for (const horizonDays of ["", "3651", "-1", "1.5"]) {
      expect(
        schema.safeParse({
          cancellationPolicyText: "",
          dailyLimitEnabled: false,
          dailyLimit: "",
          horizonMode: "days",
          horizonDays,
        }).success,
      ).toBe(false)
    }

    expect(
      schema.safeParse({
        cancellationPolicyText: "",
        dailyLimitEnabled: false,
        dailyLimit: "",
        horizonMode: "days",
        horizonDays: "0",
      }).success,
    ).toBe(true)
    expect(
      schema.safeParse({
        cancellationPolicyText: "",
        dailyLimitEnabled: false,
        dailyLimit: "",
        horizonMode: "unlimited",
        horizonDays: "3651",
      }).success,
    ).toBe(true)
  })

  it("parses only integers from 1 to 100", () => {
    expect(parseDailyLimitInput("1")).toBe(1)
    expect(parseDailyLimitInput("100")).toBe(100)
    expect(parseDailyLimitInput("08")).toBe(8)
    expect(parseDailyLimitInput("0")).toBeNull()
    expect(parseDailyLimitInput("101")).toBeNull()
  })
})


describe("cancellation cutoff policy", () => {
  const policy = { cancellationPolicyText: null, maxActiveReservationsPerCustomerPerDay: null, cancelCutoffHours: 24 }
  it("reads hours and preserves omitted, clear and replacement writes", () => {
    expect(bookingPolicySchema.parse(policy)).toHaveProperty("cancelCutoffHours", 24)
    const values = bookingPolicyToFormValues(policy)
    expect(values).toMatchObject({ cancelCutoffMode: "hours", cancelCutoffHours: "24" })
    expect(toBookingPolicyReplaceBody(values, undefined, 24)).not.toHaveProperty("cancelCutoffHours")
    expect(toBookingPolicyReplaceBody({ ...values, cancelCutoffMode: "none" }, undefined, 24)).toHaveProperty("cancelCutoffHours", null)
    expect(toBookingPolicyReplaceBody({ ...values, cancelCutoffHours: "0" }, undefined, 24)).toHaveProperty("cancelCutoffHours", 0)
  })
  it.each(["", "-1", "1.5", "8761"])("rejects invalid cutoff %s", (hours) => {
    expect(schema.safeParse({ ...bookingPolicyToFormValues(policy), cancelCutoffHours: hours }).success).toBe(false)
  })
  it.each([0, 8760])("accepts boundary %i", (hours) => {
    expect(bookingPolicySchema.parse({ ...policy, cancelCutoffHours: hours }).cancelCutoffHours).toBe(hours)
  })
})
