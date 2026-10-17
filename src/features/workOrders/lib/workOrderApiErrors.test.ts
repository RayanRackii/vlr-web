import { describe, expect, it } from "vitest"

import { localizeWorkOrderApiError } from "@/features/workOrders/lib/workOrderApiErrors"
import i18n from "@/lib/i18n"

describe("localizeWorkOrderApiError", () => {
  it("translates incomplete mandatory tasks without the server sentence", () => {
    expect(
      localizeWorkOrderApiError(
        { error: "Mandatory tasks are incomplete: Foto" },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.mandatoryTasksIncomplete"))
  })

  it("translates an ineligible asset without the raw id", () => {
    expect(
      localizeWorkOrderApiError(
        {
          code: "ASSET_NOT_ELIGIBLE",
          error:
            "Asset '12121212-1212-4121-8121-121212121212' is not eligible for this maintenance plan.",
        },
        "fallback",
      ),
    ).toBe(i18n.t("workOrders.errors.assetNotEligible"))
    expect(i18n.t("workOrders.errors.assetNotEligible")).not.toMatch(
      /12121212/,
    )
  })
})
