import { test, expect } from "@playwright/test"

import type { AdminTenant } from "../api-client"
import { adminClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { PLATFORM_ADMIN_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { tenantCommercialModules } from "../tenant"

test.describe("Tenant Edit regression", () => {
  test.use({ storageState: PLATFORM_ADMIN_STATE })
  test.describe.configure({ mode: "serial" })

  test("renders target tenant edit without PermissionProvider crash", async ({
    page,
  }) => {
    const context = readContext()
    const snapshot = readSnapshot()
    const guards = attachPageGuards(page)

    const tenantHits: string[] = []

    page.on("request", (request) => {
      const url = request.url()
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
    expect(
      tenantHits.some((url) => url.includes(`/api/admin/tenants/${context.tenantId}`)),
    ).toBe(true)
    guards.assertNoCrash()
  })

  test("target tenant modules come from admin tenant API, not users/me", async () => {
    const context = readContext()
    const snapshot = readSnapshot()
    const me = await adminClient().get<{
      tenantId: string | null
      activeModules: string[]
    }>("/api/users/me")
    const tenant = await adminClient().get<AdminTenant>(
      `/api/admin/tenants/${context.tenantId}`,
    )
    expect(tenant.status).toBe(200)
    expect(tenant.body?.id).toBe(snapshot.id)
    expect(tenantCommercialModules(tenant.body!).sort()).toEqual(
      [...snapshot.commercialModules].sort(),
    )
    expect(me.status).toBe(200)
  })
})
