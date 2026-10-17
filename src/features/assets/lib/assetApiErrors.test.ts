import { describe, expect, it } from "vitest"

import {
  assetDeleteErrorMessage,
  assetTagConflictMessage,
} from "@/features/assets/lib/assetApiErrors"
import i18n from "@/lib/i18n"

describe("asset API error copy", () => {
  it("maps an unexpected create failure to a duplicate tag", () => {
    expect(
      assetTagConflictMessage(
        { error: "An unexpected error occurred." },
        "fallback",
      ),
    ).toBe(i18n.t("assets.inventory.errors.duplicateTag"))
  })

  it("maps an unexpected asset delete to work orders", () => {
    expect(
      assetDeleteErrorMessage(
        { error: "An unexpected error occurred." },
        "fallback",
        "asset",
      ),
    ).toBe(i18n.t("assets.inventory.errors.deleteBlockedByWorkOrders"))
  })

  it("maps a category in use, including the English sentence", () => {
    expect(
      assetDeleteErrorMessage(
        {
          error:
            "Cannot permanently delete an asset category that is referenced by maintenance plans.",
        },
        "fallback",
        "category",
      ),
    ).toBe(i18n.t("assets.categories.errors.inUse"))
  })
})
