import { describe, expect, it } from "vitest"

import {
  parseWizardPrice,
  queueDraftIsValid,
  wizardPriceDraftIsValid,
} from "@/features/rentals/components/resourceWizard/wizardDrafts"

describe("wizard drafts", () => {
  it("accepts a positive price and a forward time range", () => {
    expect(parseWizardPrice("12,50")).toBe(12.5)
    expect(parseWizardPrice("0")).toBeNull()
    expect(wizardPriceDraftIsValid({
      amount: "80",
      startTime: "08:00",
      endTime: "22:00",
    })).toBe(true)
    expect(wizardPriceDraftIsValid({
      amount: "80",
      startTime: "18:00",
      endTime: "08:00",
    })).toBe(false)
  })

  it("requires an opening time only when a location queue is on", () => {
    expect(queueDraftIsValid("Good", true, "")).toBe(true)
    expect(queueDraftIsValid("Location", false, "")).toBe(true)
    expect(queueDraftIsValid("Location", true, "")).toBe(false)
    expect(queueDraftIsValid("Location", true, "07:30")).toBe(true)
  })
})
