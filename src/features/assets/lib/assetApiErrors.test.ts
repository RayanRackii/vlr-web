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

  it("maps ASSET_TAG_DUPLICATE and ASSET_IN_USE", () => {
    expect(
      assetTagConflictMessage(
        {
          error: "An asset with this tag already exists.",
          code: "ASSET_TAG_DUPLICATE",
        },
        "fallback",
      ),
    ).toBe(i18n.t("assets.inventory.errors.duplicateTag"))
    expect(
      assetDeleteErrorMessage(
        {
          error:
            "Cannot permanently delete an asset that is referenced by work orders.",
          code: "ASSET_IN_USE",
        },
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
    expect(
      assetDeleteErrorMessage(
        {
          error:
            "Cannot permanently delete an asset category that is referenced by maintenance plans.",
          code: "CATEGORY_IN_USE",
        },
        "fallback",
        "category",
      ),
    ).toBe(i18n.t("assets.categories.errors.inUse"))
  })
})
