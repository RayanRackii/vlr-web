import { test, expect } from "@playwright/test"

import { adminClient, b2bClient, customerClient, publicClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2B_STATE, PLATFORM_ADMIN_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant, updateAdminTenant } from "../tenant"

test.describe("Cross-tenant isolation", () => {
  test.describe.configure({ mode: "serial" })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("Customer JWT A cannot satisfy tenant B when B has the module OFF", async () => {
    const admin = adminClient()
    const context = readContext()
    const snapshot = readSnapshot()
    expect(context.isolationTenantId).toBeTruthy()
    expect(context.isolationTenantSlug).toBeTruthy()

    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])
    await admin.put(`/api/admin/tenants/${context.isolationTenantId}`, {
      legalName: "E2E Isolation Tenant",
      taxId: "E2EISOLATION01",
      subdomain: context.isolationTenantSlug,
      activeModules: ["catalog"],
      assetFamilyKeys: ["generic"],
    })

    const customerA = customerClient(snapshot.subdomain)
    const asB = await customerA.get(
      `/api/public/tenants/${context.isolationTenantSlug}/rental-assets`,
    )
    expect(asB.status, asB.text.slice(0, 240)).toBe(403)

    const publicB = publicClient(context.isolationTenantSlug!)
    const publicRentals = await publicB.get(
      `/api/public/tenants/${context.isolationTenantSlug}/rental-assets`,
    )
    expect(publicRentals.status).toBe(403)
  })

  test("tenant A B2B cannot read tenant B assets by id", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(
      admin,
      snapshot,
      ["inventory", "rentals"],
      ["spaces"],
    )

    const assets = await b2b.get<Array<{ id: string; tenantId?: string }>>(
      "/api/assets",
    )
    expect(assets.status).toBe(200)
    for (const asset of assets.body ?? []) {
      if (asset.tenantId) {
        expect(asset.tenantId).toBe(snapshot.id)
      }
    }

    const fakeOther = "00000000-0000-0000-0000-000000000001"
    const other = await b2b.get(`/api/assets/${context.isolationTenantId ?? fakeOther}`)
    expect([400, 404]).toContain(other.status)
  })
})

test.describe("Core / PlatformAdmin ungated", () => {
  test("core and admin endpoints are not module-gated", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["catalog"], ["generic"])

    expect((await b2b.get("/api/users/me")).status).toBe(200)
    expect((await admin.get("/api/admin/tenants")).status).toBe(200)
    expect((await admin.get(`/api/admin/tenants/${snapshot.id}`)).status).toBe(200)
    expect((await admin.get("/api/admin/modules")).status).toBe(200)
    expect((await b2b.get("/api/admin/modules")).status).toBe(403)
  })

  test("API rejects newly activating maintenance", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    const result = await updateAdminTenant(
      admin,
      snapshot,
      snapshot.id,
      [...snapshot.commercialModules, "maintenance"],
      snapshot.familyKeys,
    )
    if (snapshot.hasLegacyMaintenance) {
      expect([200, 400]).toContain(result.status)
    } else {
      expect(result.status, result.text.slice(0, 240)).toBe(400)
      expect(result.text).toMatch(/legacy module/i)
    }
  })
})

test.describe("PlatformAdmin create/edit secondary tenant", () => {
  test.use({ storageState: PLATFORM_ADMIN_STATE })

  test("reusable isolation tenant can be edited without duplicate seed", async ({
    page,
  }) => {
    const admin = adminClient()
    const context = readContext()
    expect(context.isolationTenantId).toBeTruthy()

    const before = await admin.get<{
      assetFamilyKeys: string[]
      activeModules: Array<{ moduleName: string }>
    }>(`/api/admin/tenants/${context.isolationTenantId}`)
    expect(before.status).toBe(200)

    const updated = await admin.put(
      `/api/admin/tenants/${context.isolationTenantId}`,
      {
        legalName: "E2E Isolation Tenant",
        taxId: "E2EISOLATION01",
        subdomain: context.isolationTenantSlug,
        activeModules: ["catalog", "rentals"],
        assetFamilyKeys: ["generic", "spaces"],
      },
    )
    expect(updated.status, updated.text.slice(0, 240)).toBe(200)

    const again = await admin.put(
      `/api/admin/tenants/${context.isolationTenantId}`,
      {
        legalName: "E2E Isolation Tenant",
        taxId: "E2EISOLATION01",
        subdomain: context.isolationTenantSlug,
        activeModules: ["catalog", "rentals"],
        assetFamilyKeys: ["generic", "spaces"],
      },
    )
    expect(again.status).toBe(200)

    const guards = attachPageGuards(page)
    await page.goto(`/admin/tenants/${context.isolationTenantId}/edit`)
    await expect(page.getByRole("heading", { name: "Editar cliente" })).toBeVisible({
      timeout: 30_000,
    })
    guards.assertNoCrash()

    await admin.put(`/api/admin/tenants/${context.isolationTenantId}`, {
      legalName: "E2E Isolation Tenant",
      taxId: "E2EISOLATION01",
      subdomain: context.isolationTenantSlug,
      activeModules: ["catalog"],
      assetFamilyKeys: ["generic"],
    })
  })
})

test.describe("PermissionProvider pages for tenant admin", () => {
  test.use({ storageState: B2B_STATE })

  test("cadastro and menu do not crash", async ({ page }) => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals", "catalog"], ["spaces"])
    const guards = attachPageGuards(page)
    await page.goto("/configuracoes/cadastro")
    await expect(page.getByRole("heading", { name: "Formulário de cadastro" })).toBeVisible({
      timeout: 30_000,
    })
    await page.goto("/configuracoes/menu")
    await expect(page.getByText("Itens do menu", { exact: false })).toBeVisible()
    guards.assertNoCrash()
  })
})
