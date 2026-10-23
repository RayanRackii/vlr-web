import { describe, expect, it } from "vitest"

import {
  ASSET_CATEGORY_WRITE_REQUIREMENT,
  canCreateAssetCategory,
} from "@/features/assets/services/assetCategoriesService"

describe("canCreateAssetCategory", () => {
  it("matches the module and permission required by the category POST endpoint", () => {
    const can = (permission: string) => permission === ASSET_CATEGORY_WRITE_REQUIREMENT.permission

    expect(ASSET_CATEGORY_WRITE_REQUIREMENT).toEqual({
      endpoint: "/api/asset-categories",
      module: "inventory",
      permission: "inventory.categories.write",
    })
    expect(canCreateAssetCategory(["rentals"], can)).toBe(false)
    expect(canCreateAssetCategory([ASSET_CATEGORY_WRITE_REQUIREMENT.module], can)).toBe(true)
    expect(canCreateAssetCategory(["inventory"], () => false)).toBe(false)
  })
})
