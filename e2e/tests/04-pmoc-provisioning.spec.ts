import { test, expect } from "@playwright/test"

import { adminClient, b2bClient } from "../clients"
import { readSnapshot } from "../context"
import {
  applyCommercialModules,
  restoreTenant,
  updateAdminTenant,
} from "../tenant"
import { rentalCategories } from "../lookups"

test.describe("PMOC provisioning rules", () => {
  test.describe.configure({ mode: "serial" })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("PMOC ON with generic-only families is rejected", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    const result = await updateAdminTenant(
      admin,
      snapshot,
      snapshot.id,
      ["pmoc"],
      ["generic"],
    )
    expect(result.status, result.text.slice(0, 240)).toBe(400)
    expect(result.text).toMatch(/PMOC requires at least one asset family/i)
  })

  test("enabling PMOC on an existing generic-only tenant is rejected", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["generic"])
    const result = await updateAdminTenant(
      admin,
      snapshot,
      snapshot.id,
      ["pmoc"],
      ["generic"],
    )
    expect(result.status, result.text.slice(0, 240)).toBe(400)
  })

  test("electrical enables PMOC and seeds a single Quadro elétrico", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()

    await applyCommercialModules(admin, snapshot, ["rentals"], ["generic"])
    const enabled = await applyCommercialModules(
      admin,
      snapshot,
      ["pmoc", "rentals"],
      ["generic", "electrical"],
    )
    expect(enabled.assetFamilyKeys).toContain("electrical")

    const categories = await rentalCategories(b2b)
    const quadros = categories.filter((item) => item.name === "Quadro elétrico")
    expect(quadros.length).toBeGreaterThanOrEqual(1)

    await applyCommercialModules(
      admin,
      snapshot,
      ["pmoc", "rentals"],
      ["generic", "electrical"],
    )
    const again = await rentalCategories(b2b)
    const quadrosAgain = again.filter((item) => item.name === "Quadro elétrico")
    expect(quadrosAgain.length).toBe(quadros.length)
    expect(quadrosAgain.length).toBe(1)
  })

  test("supported seed families create the expected example categories", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()

    const cases: Array<{ family: string; category: string | null }> = [
      { family: "spaces", category: "Quadra" },
      { family: "electrical", category: "Quadro elétrico" },
      { family: "goods", category: "Caçamba" },
      { family: "generic", category: null },
    ]

    for (const entry of cases) {
      await applyCommercialModules(
        admin,
        snapshot,
        ["rentals"],
        [entry.family],
      )
      const categories = await rentalCategories(b2b)
      if (entry.category) {
        expect(categories.some((item) => item.name === entry.category)).toBe(
          true,
        )
      } else {
        expect(categories.some((item) => item.name === "Generic")).toBe(false)
        expect(categories.some((item) => /fake/i.test(item.name ?? ""))).toBe(
          false,
        )
      }
    }
  })
})
