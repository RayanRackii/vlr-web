import { test, expect } from "@playwright/test"

import { adminClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { PLATFORM_ADMIN_STATE } from "../env"
import { attachPageGuards } from "../page-errors"

test.describe("Tenant Edit regression", () => {
  test.use({ storageState: PLATFORM_ADMIN_STATE })
  test.describe.configure({ mode: "serial" })

  test("renders target tenant edit without PermissionProvider crash", async ({
    page,
  }) => {
    const context = readContext()
    const snapshot = readSnapshot()
    const guards = attachPageGuards(page)

    const meHits: string[] = []
    const tenantHits: string[] = []

    page.on("request", (request) => {
      const url = request.url()
      if (url.includes("/api/users/me")) {
        meHits.push(url)
      }
      if (url.includes(`/api/admin/tenants/${context.tenantId}`)) {
        tenantHits.push(url)
      }
    })

    await page.goto(`/admin/tenants/${context.tenantId}/edit`)

    await expect(
      page.getByRole("heading", { name: "Editar cliente" }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Informações Básicas")).toBeVisible()
    await expect(page.getByText("Subdomínio e Identidade")).toBeVisible()
    await expect(page.getByText("Módulos da Plataforma")).toBeVisible()
    await expect(page.getByText("Famílias de recursos")).toBeVisible()

    await expect(page.getByRole("button", { name: /Inventário/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /^PMOC/ })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Ordens de Serviço/ }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /Aluguéis/ })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Catálogo & Pedidos/ }),
    ).toBeVisible()

    await expect(page.getByText(/Asset Registry/i)).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /^Manutenção$/ }),
    ).toHaveCount(0)

    const legalName = page.getByLabel("Razão Social")
    await expect(legalName).toHaveValue(snapshot.legalName)

    expect(tenantHits.length).toBeGreaterThan(0)
    guards.assertNoCrash()
  })

  test("target tenant modules come from admin tenant API, not users/me", async () => {
    const context = readContext()
    const snapshot = readSnapshot()
    const me = await adminClient().get<{
      tenantId: string | null
      activeModules: string[]
    }>("/api/users/me")
    const tenant = await adminClient().get<{
      id: string
      activeModules: Array<{ moduleName: string; isActive: boolean }>
    }>(`/api/admin/tenants/${context.tenantId}`)

    expect(tenant.status).toBe(200)
    expect(tenant.body?.id).toBe(snapshot.id)
    const tenantModules = (tenant.body?.activeModules ?? [])
      .filter((module) => module.isActive)
      .map((module) => module.moduleName.toLowerCase())
      .sort()
    expect(tenantModules).toEqual([...snapshot.commercialModules].sort())
    expect(me.status).toBe(200)
  })
})
