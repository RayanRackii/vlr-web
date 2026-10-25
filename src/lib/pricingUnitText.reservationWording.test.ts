import { describe, expect, it } from "vitest"

import { reservationUnitWording } from "./pricingUnitText"

describe("reservationUnitWording", () => {
  it("degrades gracefully when pricingUnit is absent", () => {
    expect(
      reservationUnitWording(
        {
          startDateTime: "2026-01-05T10:00:00.000Z",
          endDateTime: "2026-01-05T12:00:00.000Z",
        },
        "America/Sao_Paulo",
      ),
    ).toEqual({ unit: null, quantity: 1, days: null })
  })

  it("passes through explicit quantity and days", () => {
    expect(
      reservationUnitWording(
        {
          pricingUnit: "Day",
          quantity: 3,
          days: 5,
          startDateTime: "2026-01-05T00:00:00.000Z",
          endDateTime: "2026-01-09T23:59:59.000Z",
        },
        "America/Sao_Paulo",
      ),
    ).toEqual({ unit: "Day", quantity: 3, days: 5 })
  })

  it("derives days from the start/end span for Day unit when days is absent", () => {
    expect(
      reservationUnitWording(
        {
          pricingUnit: "Day",
          startDateTime: "2026-01-05T12:00:00.000Z",
          endDateTime: "2026-01-07T12:00:00.000Z",
        },
        "America/Sao_Paulo",
      ),
    ).toEqual({ unit: "Day", quantity: 1, days: 3 })
  })

  it("does not derive days for a non-Day unit even across a multi-day span", () => {
    expect(
      reservationUnitWording(
        {
          pricingUnit: "Hour",
          startDateTime: "2026-01-05T12:00:00.000Z",
          endDateTime: "2026-01-07T12:00:00.000Z",
        },
        "America/Sao_Paulo",
      ),
    ).toEqual({ unit: "Hour", quantity: 1, days: null })
  })
})
