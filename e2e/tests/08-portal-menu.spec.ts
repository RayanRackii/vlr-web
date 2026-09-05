import { test, expect } from "@playwright/test"

import { adminClient, b2bClient, publicClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2B_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant } from "../tenant"

test.describe("Portal Menu, Explore módulos, Registration", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2B_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("menu configuration only allows rentals and catalog", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(
      admin,
      snapshot,
      ["rentals", "catalog"],
      ["spaces"],
    )

    const created = await b2b.post<{ id: string }>(`/api/module-menu-items`, {
      moduleName: "inventory",
      label: `E2E Inventory ${context.runId}`,
      sortOrder: 99,
      isActive: true,
    })
    expect([400, 403], created.text.slice(0, 240)).toContain(created.status)

    const rentalsItem = await b2b.post<{ id: string; moduleName: string }>(
      `/api/module-menu-items`,
      {
        moduleName: "rentals",
        label: `E2E Menu Rentals ${context.runId}`,
        sortOrder: 90,
        isActive: true,
      },
    )
    expect(rentalsItem.status, rentalsItem.text.slice(0, 240)).toBe(201)

    await applyCommercialModules(
      admin,
      snapshot,
      ["catalog", "inventory"],
      ["spaces"],
    )
    const publicMenu = await publicClient(snapshot.subdomain).get(
      `/api/public/tenants/${snapshot.subdomain}/menu`,
    )
    expect(publicMenu.status).toBe(200)
    const labels = ((publicMenu.body as Array<{ label: string; moduleName: string }>) ?? [])
      .map((item) => item.label)
    expect(labels.some((label) => label.includes("E2E Menu Rentals"))).toBe(
      false,
    )

    const managed = await b2b.get<Array<{ label: string }>>("/api/module-menu-items")
    expect(managed.status).toBe(200)
    expect(
      managed.body?.some((item) => item.label.includes("E2E Menu Rentals")),
    ).toBe(true)
  })

  test("Explore módulos shows the commercial set and never calls admin/modules", async ({
    page,
  }) => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(
      admin,
      snapshot,
      ["rentals", "catalog"],
      ["spaces"],
    )

    const adminModuleCalls: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/api/admin/modules")) {
        adminModuleCalls.push(request.url())
      }
    })

    const guards = attachPageGuards(page)
    await page.goto("/configuracoes/menu")
    await page.getByRole("button", { name: "Explore módulos" }).click()
    await expect(page.getByRole("main").getByText("Inventário")).toBeVisible()
    await expect(page.getByRole("main").getByText("PMOC")).toBeVisible()
    await expect(page.getByRole("main").getByText("Ordens de Serviço")).toBeVisible()
    await expect(page.getByRole("main").getByText("Aluguéis")).toBeVisible()
    await expect(
      page.getByRole("main").getByText("Catálogo & Pedidos"),
    ).toBeVisible()
    await expect(page.getByText(/Asset Registry/i)).toHaveCount(0)
    await expect(page.getByText("Manutenção")).toHaveCount(0)

    await expect(page.getByText("Ativo").first()).toBeVisible()
    await expect(page.getByText("Disponível").first()).toBeVisible()
    expect(adminModuleCalls).toHaveLength(0)
    guards.assertNoCrash()
  })

  test("registration configuration renders inside PermissionProvider", async ({
    page,
  }) => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    const guards = attachPageGuards(page)
    await page.goto("/configuracoes/cadastro")
    await expect(
      page.getByRole("heading", { name: "Formulário de cadastro" }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole("heading", { name: "Campos padrão" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "+ Adicionar campo" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByLabel("Nome do campo").fill(`E2E Campo ${context.runId}`)
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText(`E2E Campo ${context.runId}`)).toBeVisible({
      timeout: 20_000,
    })

    const fields = await b2b.get<Array<{ id: string; label: string }>>(
      "/api/registration-fields",
    )
    const created = fields.body?.find((field) =>
      field.label.includes(context.runId),
    )
    if (created) {
      await b2b.delete(`/api/registration-fields/${created.id}`)
    }
    guards.assertNoCrash()
  })
})
