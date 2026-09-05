import { test, expect } from "@playwright/test"

import { adminClient, b2bClient, customerClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2B_STATE, B2C_STATE, PLATFORM_ADMIN_STATE } from "../env"
import { attachPageGuards } from "../page-errors"

test.describe("authentication identities", () => {
  test("PlatformAdmin can list tenants and load the module catalog", async () => {
    const admin = adminClient()
    const tenants = await admin.get("/api/admin/tenants")
    const modules = await admin.get("/api/admin/modules")
    expect(tenants.status, tenants.text.slice(0, 200)).toBe(200)
    expect(modules.status, modules.text.slice(0, 200)).toBe(200)
    expect(Array.isArray(modules.body)).toBe(true)
  })

  test("B2B session is bound to the target tenant", async () => {
    const context = readContext()
    const me = await b2bClient().get<{ tenantId: string; email: string }>(
      "/api/users/me",
    )
    expect(me.status).toBe(200)
    expect(me.body?.tenantId).toBe(context.tenantId)
  })

  test("Customer session is a B2C customer of the target tenant", async () => {
    const snapshot = readSnapshot()
    const me = await customerClient(snapshot.subdomain).get("/api/customers/me")
    expect(me.status, me.text.slice(0, 200)).toBe(200)
  })
})

test.describe("PlatformAdmin UI session", () => {
  test.use({ storageState: PLATFORM_ADMIN_STATE })

  test("PlatformAdmin UI reaches an authenticated area", async ({ page }) => {
    const guards = attachPageGuards(page)
    await page.goto("/dashboard")
    await expect(page).not.toHaveURL(/\/login/)
    guards.assertNoCrash()
  })
})

test.describe("B2B UI session", () => {
  test.use({ storageState: B2B_STATE })

  test("B2B UI stays in the tenant product", async ({ page }) => {
    const guards = attachPageGuards(page)
    await page.goto("/dashboard")
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole("heading", { name: /Centro de Comando/i }),
    ).toBeVisible({ timeout: 30_000 })
    guards.assertNoCrash()
  })
})

test.describe("B2C UI session", () => {
  test.use({ storageState: B2C_STATE })

  test("Customer UI lands in the branded portal app", async ({ page }) => {
    const snapshot = readSnapshot()
    const guards = attachPageGuards(page)
    await page.goto(`/t/${snapshot.subdomain}/app`)
    await expect(page).not.toHaveURL(new RegExp(`/t/${snapshot.subdomain}$`))
    guards.assertNoCrash()
  })
})
