import { describe, expect, it } from "vitest"

import {
  getTemplateRevisionFormDefaults,
  mergeTemplateOptions,
} from "@/features/rentals/components/rentalResourceFormDefaults"

describe("mergeTemplateOptions", () => {
  it("retains a newly created template when the active filters exclude it", () => {
    expect(mergeTemplateOptions([], [{ value: "published-1", label: "Modelo novo" }], "Sem modelo")).toEqual([
      { value: "__no-template__", label: "Sem modelo" },
      { value: "published-1", label: "Modelo novo" },
    ])
  })

  it("keeps an explicit deposit choice after it returns to its initial value", () => {
    const revision = {
      suggestedCapacityPeople: 8,
      defaultRequiresDeposit: false,
      defaultMaxAdvanceBookingDays: 14,
    }

    // The user switched deposit off and then back on; dirty would now be false.
    const defaults = getTemplateRevisionFormDefaults(
      revision,
      new Set(["requiresDeposit"]),
    )

    expect(defaults).toEqual({
      capacityPeople: "8",
      horizonMode: "days",
      horizonDays: "14",
    })
    expect(defaults).not.toHaveProperty("requiresDeposit")
  })

  it("leaves fields unchanged for null or absent revision defaults", () => {
    expect(getTemplateRevisionFormDefaults({
      suggestedCapacityPeople: null,
      defaultRequiresDeposit: null,
      defaultMaxAdvanceBookingDays: null,
    }, new Set())).toEqual({})
  })
})
