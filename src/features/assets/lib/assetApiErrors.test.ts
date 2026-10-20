import { describe, expect, it } from "vitest"

import {
  assetDeleteErrorMessage,
  assetTagConflictMessage,
  localizeAssetApiError,
} from "@/features/assets/lib/assetApiErrors"
import i18n from "@/lib/i18n"

const unexpected = { error: "An unexpected error occurred." }

describe("asset API error copy", () => {
  it("does not treat the generic 500 message as a duplicate tag", () => {
    expect(assetTagConflictMessage(500, unexpected, "fallback")).toBe("fallback")
    expect(assetTagConflictMessage(null, unexpected, "fallback")).toBe("fallback")
  })

  it("does not treat the generic 500 message as a blocked delete", () => {
    expect(assetDeleteErrorMessage(500, unexpected, "fallback", "asset")).toBe(
      "fallback",
    )
    expect(
      assetDeleteErrorMessage(500, unexpected, "fallback", "category"),
    ).toBe("fallback")
    expect(
      assetDeleteErrorMessage(
        500,
        { error: "An unexpected error occurred.", code: "ASSET_IN_USE" },
        "fallback",
        "asset",
      ),
    ).toBe("fallback")
  })

  it("maps only 409 ASSET_TAG_DUPLICATE, ASSET_IN_USE, and CATEGORY_IN_USE", () => {
    expect(
      assetTagConflictMessage(
        409,
        {
          error: "An asset with this tag already exists.",
          code: "ASSET_TAG_DUPLICATE",
        },
        "fallback",
      ),
    ).toBe(i18n.t("assets.inventory.errors.duplicateTag"))
    expect(
      assetTagConflictMessage(
        400,
        { error: "An asset with this tag already exists.", code: "ASSET_TAG_DUPLICATE" },
        "fallback",
      ),
    ).toBe("fallback")
    expect(
      assetDeleteErrorMessage(
        409,
        {
          error:
            "Cannot permanently delete an asset that is referenced by work orders.",
          code: "ASSET_IN_USE",
        },
        "fallback",
        "asset",
      ),
    ).toBe(i18n.t("assets.inventory.errors.deleteBlockedByWorkOrders"))
    expect(
      assetDeleteErrorMessage(
        409,
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

  it("leaves every other payload on the generic localized error", () => {
    expect(
      assetDeleteErrorMessage(
        409,
        {
          error:
            "Cannot permanently delete an asset category that is referenced by maintenance plans.",
        },
        "fallback",
        "category",
      ),
    ).toBe("fallback")
    expect(
      assetDeleteErrorMessage(
        409,
        { error: "Cannot permanently delete an asset category.", code: "ASSET_IN_USE" },
        "fallback",
        "category",
      ),
    ).toBe("fallback")
    expect(
      assetTagConflictMessage(
        409,
        { error: "tags already exist", code: "ASSET_IN_USE" },
        "fallback",
      ),
    ).toBe("fallback")
    expect(
      localizeAssetApiError(
        { error: "An unexpected error occurred." },
        "fallback",
        500,
      ),
    ).toBe("fallback")
    expect(
      localizeAssetApiError({ error: "FORBIDDEN" }, "fallback", 403),
    ).toBe(i18n.t("rbac.errors.FORBIDDEN"))
    expect(localizeAssetApiError({ error: "FORBIDDEN" }, "fallback", 403)).not.toBe(
      "FORBIDDEN",
    )
    expect(
      localizeAssetApiError(
        { error: "An asset with this tag already exists.", code: "ASSET_TAG_DUPLICATE" },
        "fallback",
        409,
      ),
    ).toBe(i18n.t("assets.inventory.errors.duplicateTag"))
  })
})
