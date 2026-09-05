import { test, expect, type Page } from "@playwright/test"

import { adminClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2B_STATE, PLATFORM_ADMIN_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant } from "../tenant"

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

async function visit(
  page: Page,
  path: string,
  assertion: () => Promise<void>,
): Promise<void> {
  const guards = attachPageGuards(page)
  await page.goto(path)
  await assertion()
  guards.assertNoCrash()
}

test.describe("Desktop PlatformAdmin", () => {
  test.use({ storageState: PLATFORM_ADMIN_STATE })

  test("tenant edit at desktop", async ({ page }) => {
    const context = readContext()
    await page.setViewportSize(DESKTOP)
    await visit(page, `/admin/tenants/${context.tenantId}/edit`, async () => {
      await expect(page.getByRole("heading", { name: "Editar cliente" })).toBeVisible({
        timeout: 30_000,
      })
    })
  })
})

test.describe("Desktop + mobile tenant product", () => {
  test.use({ storageState: B2B_STATE })
  test.describe.configure({ mode: "serial" })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  for (const viewport of [
    { name: "desktop", size: DESKTOP },
    { name: "mobile", size: MOBILE },
  ]) {
    test(`${viewport.name} Recursos, PMOC, OS, Catalog, Portal Menu`, async ({
      page,
    }) => {
      const admin = adminClient()
      const snapshot = readSnapshot()
      await applyCommercialModules(
        admin,
        snapshot,
        ["inventory", "pmoc", "os", "rentals", "catalog"],
        ["spaces", "electrical"],
      )
      await page.setViewportSize(viewport.size)

      await visit(page, "/configuracoes/recursos", async () => {
        await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible({
          timeout: 30_000,
        })
      })
      await visit(page, "/pmoc/novo", async () => {
        await expect(
          page.getByRole("heading", { name: "Novo Plano de Manutenção" }),
        ).toBeVisible({ timeout: 30_000 })
      })
      await visit(page, "/os/nova", async () => {
        await expect(page.getByText("Nova Ordem de Serviço")).toBeVisible({
          timeout: 30_000,
        })
      })
      await visit(page, "/catalogo/produtos", async () => {
        await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible({
          timeout: 30_000,
        })
      })
      await visit(page, "/configuracoes/menu", async () => {
        await expect(page.getByText("Explore módulos")).toBeVisible({
          timeout: 30_000,
        })
      })
    })
  }
})
