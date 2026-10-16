import { describe, expect, it } from "vitest"

import {
  createRentableRequestSchema,
  createRentalResourceFormSchema,
  resolveResourceHorizonWrite,
  toCreateRentableRequest,
  type RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"

const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const FAMILY_ID = "11111111-1111-4111-8111-111111111111"

const schema = createRentalResourceFormSchema({
  nameRequired: "name",
  tagRequired: "tag",
  unitRequired: "unit",
  categoryRequired: "category",
  familyRequired: "family",
  quantityMin: "quantity",
  queueOpeningTimeRequired: "queue",
  horizonRange: "horizon",
})

function formValues(
  horizon: Pick<RentalResourceFormValues, "horizonMode" | "horizonDays">,
): RentalResourceFormValues {
  return {
    name: "Space 1",
    tag: "S-01",
    unitId: UNIT_ID,
    categoryId: CATEGORY_ID,
    familyId: FAMILY_ID,
    rentalType: "Location",
    totalQuantity: 1,
    requiresDeposit: true,
    queueEnabled: false,
    queueOpeningTime: "",
    location: "Block A",
    ...horizon,
  }
}

describe("resource booking horizon", () => {
  it("omits the tenant default, sends null for unlimited, and sends a number of days", () => {
    const inherit = toCreateRentableRequest(
      formValues({ horizonMode: "inherit", horizonDays: "" }),
      { creating: true, stored: undefined },
    )
    expect(inherit).not.toHaveProperty("maxAdvanceBookingDays")

    expect(
      toCreateRentableRequest(
        formValues({ horizonMode: "unlimited", horizonDays: "" }),
        { creating: true, stored: undefined },
      ).maxAdvanceBookingDays,
    ).toBeNull()

    expect(
      toCreateRentableRequest(
        formValues({ horizonMode: "days", horizonDays: "14" }),
        { creating: true, stored: undefined },
      ).maxAdvanceBookingDays,
    ).toBe(14)

    const unchanged = toCreateRentableRequest(
      formValues({ horizonMode: "days", horizonDays: "14" }),
      { creating: false, stored: 14 },
    )
    expect(unchanged).not.toHaveProperty("maxAdvanceBookingDays")

    expect(
      toCreateRentableRequest(
        formValues({ horizonMode: "days", horizonDays: "0" }),
        { creating: false, stored: 14 },
      ).maxAdvanceBookingDays,
    ).toBe(0)

    expect(
      toCreateRentableRequest(
        formValues({ horizonMode: "inherit", horizonDays: "" }),
        { creating: false, stored: 14 },
      ).maxAdvanceBookingDays,
    ).toBeNull()

    expect(
      toCreateRentableRequest(
        formValues({ horizonMode: "inherit", horizonDays: "" }),
        { creating: false, stored: null },
      ),
    ).not.toHaveProperty("maxAdvanceBookingDays")

    expect(
      toCreateRentableRequest(
        formValues({ horizonMode: "unlimited", horizonDays: "9" }),
        { creating: false, stored: null },
      ).maxAdvanceBookingDays,
    ).toBeNull()

    expect(resolveResourceHorizonWrite("days", "3650", {
      creating: true,
      stored: undefined,
    })).toBe(3650)
    expect(() =>
      resolveResourceHorizonWrite("days", "3651", {
        creating: false,
        stored: 1,
      }),
    ).toThrow("Booking horizon is invalid.")
  })

  it("rejects a horizon outside 0..3650 on the form and the request", () => {
    const base = formValues({ horizonMode: "days", horizonDays: "10" })
    expect(schema.safeParse(base).success).toBe(true)
    expect(
      schema.safeParse({ ...base, horizonDays: "3651" }).success,
    ).toBe(false)
    expect(schema.safeParse({ ...base, horizonDays: "-1" }).success).toBe(false)
    expect(schema.safeParse({ ...base, horizonDays: "" }).success).toBe(false)
    expect(
      schema.safeParse({
        ...base,
        horizonMode: "unlimited",
        horizonDays: "3651",
      }).success,
    ).toBe(true)

    const request = {
      name: "Space 1",
      tag: "S-01",
      unitId: UNIT_ID,
      categoryId: CATEGORY_ID,
      familyId: FAMILY_ID,
      rentalType: "Location" as const,
      totalQuantity: 1,
      requiresDeposit: true,
      queueEnabled: false,
      queueOpeningTime: null,
      location: null,
    }
    expect(
      createRentableRequestSchema.safeParse({
        ...request,
        maxAdvanceBookingDays: 3651,
      }).success,
    ).toBe(false)
    expect(
      createRentableRequestSchema.safeParse({
        ...request,
        maxAdvanceBookingDays: 0,
      }).success,
    ).toBe(true)
    expect(
      createRentableRequestSchema.safeParse({
        ...request,
        maxAdvanceBookingDays: null,
      }).success,
    ).toBe(true)
  })
})
