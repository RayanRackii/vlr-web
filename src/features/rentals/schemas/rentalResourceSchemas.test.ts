import { describe, expect, it } from "vitest"

import {
  createRentableRequestSchema,
  createRentalResourceFormSchema,
  resolveResourceHorizonWrite,
  toCreateRentableRequest,
  type RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import { rentalAssetSchema } from "@/features/rentals/services/scheduleService"

const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const FAMILY_ID = "11111111-1111-4111-8111-111111111111"
const DETERMINISTIC_GUID = "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b"

const schema = createRentalResourceFormSchema({
  nameRequired: "name",
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
    visualTemplateRevisionId: "",
    capacityPeople: "",
    confirmVisualSuggestions: false,
    ...horizon,
  }
}

describe("resource booking horizon", () => {
  it("normalizes a legacy capacity response so the resource form can retain it", () => {
    const asset = rentalAssetSchema.parse({
      id: UNIT_ID,
      assetId: UNIT_ID,
      name: "Space 1",
      isActive: true,
      unitId: UNIT_ID,
      capacity: 8,
    })

    expect(asset.capacityPeople).toBe(8)
  })

  it("accepts a blank identifier and omits it from the rentable payload", () => {
    const values = {
      ...formValues({ horizonMode: "inherit", horizonDays: "" }),
      tag: "",
    }

    expect(schema.safeParse(values).success).toBe(true)
    expect(toCreateRentableRequest(values)).not.toHaveProperty("tag")
  })

  it("accepts deterministic GUIDs while editing a resource with visual data", () => {
    const values = {
      ...formValues({ horizonMode: "inherit", horizonDays: "" }),
      unitId: DETERMINISTIC_GUID,
      categoryId: DETERMINISTIC_GUID,
      visualTemplateRevisionId: DETERMINISTIC_GUID,
      capacityPeople: "8",
      location: "Quadra externa",
    }

    expect(schema.safeParse(values).success).toBe(true)
    expect(toCreateRentableRequest(values).visualTemplateRevisionId).toBe(
      DETERMINISTIC_GUID,
    )
  })

  it("does not defer template defaults to the API", () => {
    const values = {
      ...formValues({ horizonMode: "inherit", horizonDays: "" }),
      visualTemplateRevisionId: DETERMINISTIC_GUID,
    }

    expect(toCreateRentableRequest(values, {
      creating: true,
      stored: undefined,
    })).toMatchObject({ visualTemplateRevisionId: DETERMINISTIC_GUID })
    expect(toCreateRentableRequest(values, {
      creating: true,
      stored: undefined,
    })).not.toHaveProperty("applyTemplateDefaults")
  })

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

  it("sends explicit nulls when an existing visual assignment or capacity is cleared", () => {
    const values = {
      ...formValues({ horizonMode: "inherit", horizonDays: "" }),
      visualTemplateRevisionId: "",
      capacityPeople: "",
      confirmVisualSuggestions: false,
    }
    expect(toCreateRentableRequest(values, {
      creating: false,
      stored: undefined,
      storedVisualTemplateRevisionId: FAMILY_ID,
      storedCapacityPeople: 8,
    })).toMatchObject({ visualTemplateRevisionId: null, capacityPeople: null })
  })
})


describe("resource cancellation cutoff", () => {
  const base = () => ({ ...formValues({ horizonMode: "inherit", horizonDays: "" }), cancelCutoffMode: "inherit" as const, cancelCutoffHours: "" })
  it("omits unchanged overrides, clears inheritance and replaces hours", () => {
    expect(toCreateRentableRequest(base())).not.toHaveProperty("cancelCutoffHours")
    expect(toCreateRentableRequest({ ...base(), cancelCutoffStored: 24 })).toHaveProperty("cancelCutoffHours", null)
    expect(toCreateRentableRequest({ ...base(), cancelCutoffMode: "none" })).toHaveProperty("cancelCutoffHours", 0)
    expect(toCreateRentableRequest({ ...base(), cancelCutoffMode: "none", cancelCutoffStored: 24 })).toHaveProperty("cancelCutoffHours", 0)
    expect(toCreateRentableRequest({ ...base(), cancelCutoffMode: "none", cancelCutoffStored: 0 })).not.toHaveProperty("cancelCutoffHours")
    expect(toCreateRentableRequest({ ...base(), cancelCutoffStored: 0 })).toHaveProperty("cancelCutoffHours", null)
    expect(toCreateRentableRequest({ ...base(), cancelCutoffMode: "hours", cancelCutoffHours: "24", cancelCutoffStored: 24 })).not.toHaveProperty("cancelCutoffHours")
    expect(toCreateRentableRequest({ ...base(), cancelCutoffMode: "hours", cancelCutoffHours: "0" })).toHaveProperty("cancelCutoffHours", 0)
  })
  it.each(["", "-1", "2.5", "8761"])("rejects invalid cutoff %s", (hours) => {
    expect(schema.safeParse({ ...base(), cancelCutoffMode: "hours", cancelCutoffHours: hours }).success).toBe(false)
  })
  it.each([0, 8760])("preserves boundary %i in requests", (hours) => {
    expect(createRentableRequestSchema.parse({ ...toCreateRentableRequest(base()), cancelCutoffHours: hours }).cancelCutoffHours).toBe(hours)
  })
})
