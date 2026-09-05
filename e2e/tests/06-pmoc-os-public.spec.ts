import { test, expect } from "@playwright/test"

import { adminClient, b2bClient, customerClient, publicClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2B_STATE, B2C_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant } from "../tenant"
import { categoryByName, familyByKey, firstUnit } from "../lookups"

test.describe("Public and B2C Rentals", () => {
  test.describe.configure({ mode: "serial" })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("Rentals ON: public resources and schedule resolve the resource tenant", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    const publicApi = publicClient(snapshot.subdomain)
    const resources = await publicApi.get(
      `/api/public/tenants/${snapshot.subdomain}/rental-assets`,
    )
    expect(resources.status, resources.text.slice(0, 240)).toBe(200)

    const today = new Date().toISOString().slice(0, 10)
    const schedule = await publicApi.get(
      `/api/public/tenants/${snapshot.subdomain}/schedule/days/${today}`,
    )
    expect([200, 404]).toContain(schedule.status)
    expect(schedule.status).not.toBe(403)
  })

  test("Customer rental surface is available when Rentals is ON", async () => {
    const snapshot = readSnapshot()
    const customer = customerClient(snapshot.subdomain)
    const mine = await customer.get("/api/reservations/mine")
    expect([200, 404]).toContain(mine.status)
    expect(mine.status).not.toBe(403)
  })

  test("Rentals OFF: public and customer rental surfaces are 403", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["catalog"], ["generic"])

    const publicApi = publicClient(snapshot.subdomain)
    const resources = await publicApi.get(
      `/api/public/tenants/${snapshot.subdomain}/rental-assets`,
    )
    expect(resources.status).toBe(403)

    const customer = customerClient(snapshot.subdomain)
    const mine = await customer.get("/api/reservations/mine")
    expect(mine.status).toBe(403)
  })
})

test.describe("B2C Rentals UI", () => {
  test.use({ storageState: B2C_STATE })

  test("Customer portal app renders when Rentals is ON", async ({ page }) => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])
    const guards = attachPageGuards(page)
    await page.goto(`/t/${snapshot.subdomain}/app`)
    await expect(page).not.toHaveURL(/\/login/)
    guards.assertNoCrash()
  })
})

test.describe("PMOC without Inventory", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2B_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("/pmoc/novo does not redirect to /ativos and can save an E2E plan", async ({
    page,
  }) => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(
      admin,
      snapshot,
      ["pmoc"],
      ["electrical", "generic"],
    )

    const assets = await b2b.get("/api/assets")
    expect(assets.status).toBe(403)

    const guards = attachPageGuards(page)
    await page.goto("/pmoc/novo")
    await expect(page).not.toHaveURL(/\/ativos/)
    await expect(
      page.getByRole("heading", { name: "Novo Plano de Manutenção" }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Asset Registry/i)).toHaveCount(0)

    const unit = await firstUnit(b2b)
    const categories = await b2b.get<Array<{ id: string; name: string }>>(
      "/api/maintenance-plans/asset-categories",
    )
    expect(categories.status).toBe(200)
    const quadro = categories.body?.find((item) => item.name === "Quadro elétrico")
    expect(quadro, "Quadro elétrico should be selectable").toBeTruthy()

    const planName = `E2E-Plan ${context.runId}`
    const created = await b2b.post<{ id: string; name: string }>(
      "/api/maintenance-plans",
      {
        unitId: unit.id,
        name: planName,
        description: "E2E certification plan",
        frequency: "Monthly",
        assetCategoryId: quadro!.id,
        isActive: true,
        tasks: [
          {
            title: "E2E checklist",
            inputType: "Checkbox",
            isMandatory: true,
            order: 1,
          },
        ],
      },
    )
    expect(created.status, created.text.slice(0, 240)).toBe(201)

    await page.goto("/pmoc")
    await expect(page.getByText(planName)).toBeVisible({ timeout: 30_000 })
    guards.assertNoCrash()
  })
})

test.describe("OS without Inventory", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2B_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("empty OS create state has no Ativos dependency", async ({ page }) => {
    const admin = adminClient()
    const context = readContext()
    expect(context.isolationTenantId).toBeTruthy()

    await admin.put(`/api/admin/tenants/${context.isolationTenantId}`, {
      legalName: "E2E Isolation Tenant",
      taxId: "E2EISOLATION01",
      subdomain: context.isolationTenantSlug,
      activeModules: ["os"],
      assetFamilyKeys: ["generic"],
    })

    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["os"], ["generic"])

    const b2b = b2bClient()
    const assets = await b2b.get("/api/work-orders/assets")
    expect(assets.status).toBe(200)

    const guards = attachPageGuards(page)
    await page.goto("/os/nova")
    await expect(page).not.toHaveURL(/\/ativos/)
    await expect(page.getByRole("link", { name: /ativos/i })).toHaveCount(0)
    if ((assets.body as unknown[] | null)?.length === 0) {
      await expect(
        page.getByText("Nenhum recurso disponível"),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(/\/ativos/)).toHaveCount(0)
    }
    guards.assertNoCrash()
  })

  test("a Rentals-created resource appears in OS assets and can be referenced", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(
      admin,
      snapshot,
      ["os", "rentals"],
      ["spaces"],
    )

    const createAsset = await b2b.post("/api/assets")
    expect(createAsset.status).toBe(403)

    const unit = await firstUnit(b2b)
    const family = await familyByKey(b2b, "spaces")
    const category = await categoryByName(b2b, "Quadra")
    const name = `E2E OS Asset ${context.runId}`
    const created = await b2b.post<{ id: string; assetId: string }>(
      "/api/rental-assets",
      {
        name,
        tag: `E2E-OS-${context.runId.slice(-8)}`,
        unitId: unit.id,
        categoryId: category.id,
        familyId: family.id,
        rentalType: "Location",
        totalQuantity: 1,
        requiresDeposit: false,
      },
    )
    expect(created.status, created.text.slice(0, 240)).toBe(201)

    const picker = await b2b.get<Array<{ id: string; name: string }>>(
      "/api/work-orders/assets",
    )
    expect(picker.status).toBe(200)
    expect(picker.body?.some((item) => item.name === name)).toBe(true)

    const assetId =
      picker.body?.find((item) => item.name === name)?.id ??
      created.body?.assetId
    const workOrder = await b2b.post("/api/work-orders", {
      assetId,
      scheduledDate: new Date().toISOString().slice(0, 10),
      notes: `E2E Work Order ${context.runId}`,
      tasks: [
        {
          title: "E2E OS task",
          inputType: "Checkbox",
          isMandatory: true,
          order: 1,
        },
      ],
    })
    expect(workOrder.status, workOrder.text.slice(0, 240)).toBe(201)
  })
})
