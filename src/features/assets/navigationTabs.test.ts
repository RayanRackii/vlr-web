import { describe, expect, it } from "vitest"

import { filterNavigationTabs } from "@/components/layout/navigationTabs"
import { equipmentTabs } from "@/features/assets/navigationTabs"

const permissions = ["inventory.assets.read", "inventory.categories.read"]

describe("equipmentTabs", () => {
  it("hides the resource types tab when the tenant has no rentals module", () => {
    const tabs = filterNavigationTabs(equipmentTabs, ["inventory"], permissions)
    expect(tabs.map((tab) => tab.to)).toEqual(["/ativos"])
  })

  it("shows the resource types tab when rentals is active", () => {
    const tabs = filterNavigationTabs(equipmentTabs, ["inventory", "rentals"], permissions)
    expect(tabs.map((tab) => tab.to)).toEqual(["/ativos", "/ativos/tipos"])
  })
})
