import { test, expect } from "@playwright/test"

import { adminClient, b2bClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2B_STATE } from "../env"
import { assertRuntimeGates } from "../gates"
import { attachPageGuards } from "../page-errors"
import {
  applyCommercialModules,
  restoreTenant,
} from "../tenant"
import {
  categoryByName,
  familyByKey,
  firstUnit,
} from "../lookups"

test.describe("Inventory and Rentals", () => {
  test.describe.configure({ mode: "serial" })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("Inventory ON: create, edit, list and cleanup an E2E asset", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()

    await applyCommercialModules(
      admin,
      snapshot,
      ["inventory", "rentals"],
      ["spaces", "electrical", "generic"],
    )

    const unit = await firstUnit(b2b)
    const family = await familyByKey(b2b, "spaces")
    const category = await categoryByName(b2b, "Quadra")
    const name = `E2E-Asset ${context.runId}`
    const tag = `E2E-A-${context.runId.slice(-8)}`

    const created = await b2b.post<{ id: string; name: string }>("/api/assets", {
      unitId: unit.id,
      categoryId: category.id,
      familyId: family.id,
      name,
      tag,
      status: "Active",
      isRentable: false,
      requiresMaintenance: false,
    })
    expect(created.status, created.text.slice(0, 240)).toBe(201)
    const assetId = created.body?.id
    expect(assetId).toBeTruthy()

    const listed = await b2b.get<Array<{ id: string; name: string }>>("/api/assets")
    expect(listed.status).toBe(200)
    expect(listed.body?.some((item) => item.id === assetId)).toBe(true)

    const updated = await b2b.put(`/api/assets/${assetId}`, {
      unitId: unit.id,
      categoryId: category.id,
      familyId: family.id,
      name: `${name} edit`,
      tag,
      status: "Active",
      isRentable: false,
      requiresMaintenance: false,
    })
    expect(updated.status, updated.text.slice(0, 240)).toBe(200)

    const removed = await b2b.delete(`/api/assets/${assetId}`)
    expect([200, 204]).toContain(removed.status)
  })

  test("Inventory OFF 403s /api/assets", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])
    await assertRuntimeGates(b2b, ["rentals"])
  })
})

test.describe("Rentals without Inventory — UI", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2B_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("Recursos is visible and Ativos is absent", async ({ page }) => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    const guards = attachPageGuards(page)
    await page.goto("/dashboard")
    await expect(page.locator("aside").getByText("Ativos", { exact: true })).toHaveCount(
      0,
    )
    await expect(page.locator('a[href="/configuracoes/recursos"]')).toBeVisible({
      timeout: 30_000,
    })
    guards.assertNoCrash()
  })

  test("create, list and edit a rentable, then see it on Agenda", async ({
    page,
  }) => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    const unit = await firstUnit(b2b)
    const family = await familyByKey(b2b, "spaces")
    const category = await categoryByName(b2b, "Quadra")
    const name = `E2E Quadra ${context.runId}`
    const tag = `E2E-Q-${context.runId.slice(-8)}`

    const created = await b2b.post<{ id: string; assetId: string; name: string }>(
      "/api/rental-assets",
      {
        name,
        tag,
        unitId: unit.id,
        categoryId: category.id,
        familyId: family.id,
        rentalType: "Location",
        totalQuantity: 1,
        requiresDeposit: false,
      },
    )
    expect(created.status, created.text.slice(0, 240)).toBe(201)
    expect(created.body?.name).toBe(name)

    const listed = await b2b.get<Array<{ name: string }>>("/api/rental-assets")
    expect(listed.status).toBe(200)
    expect(listed.body?.some((item) => item.name === name)).toBe(true)

    const assetsForbidden = await b2b.get("/api/assets")
    expect(assetsForbidden.status).toBe(403)

    const guards = attachPageGuards(page)
    await page.goto("/configuracoes/recursos")
    await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(name)).toBeVisible()

    await page.goto("/configuracoes/agenda")
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 })
    guards.assertNoCrash()

    if (created.body?.id) {
      await b2b.put(`/api/rental-assets/${created.body.id}`, {
        name: `${name} edit`,
        tag,
        unitId: unit.id,
        categoryId: category.id,
        familyId: family.id,
        rentalType: "Location",
        totalQuantity: 1,
        requiresDeposit: false,
      })
    }
  })
})

test.describe("Rentals + Inventory together", () => {
  test.use({ storageState: B2B_STATE })

  test("Ativos and Recursos both work and stay distinct", async ({ page }) => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(
      admin,
      snapshot,
      ["inventory", "rentals"],
      ["spaces"],
    )

    const guards = attachPageGuards(page)
    await page.goto("/dashboard")
    await expect(
      page.locator("aside").getByText("Ativos", { exact: true }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('a[href="/ativos"]')).toBeVisible()
    await expect(page.locator('a[href="/configuracoes/recursos"]')).toBeVisible()

    await page.goto("/ativos")
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto("/configuracoes/recursos")
    await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible()
    guards.assertNoCrash()
  })
})
