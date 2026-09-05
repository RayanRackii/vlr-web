import { test, expect } from "@playwright/test"

import { adminClient, b2bClient, customerClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { loadE2eEnv } from "../env"
import { B2B_STATE, B2C_STATE } from "../env"
import { readTokens } from "../context"
import { TINY_PNG } from "../lookups"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant } from "../tenant"
import { assertRuntimeGates } from "../gates"

test.describe("Catalog independent of Inventory", () => {
  test.describe.configure({ mode: "serial" })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("B2B can create, edit and upload an image for an E2E product", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["catalog"], ["generic"])
    await assertRuntimeGates(b2b, ["catalog"])

    const inventory = await b2b.get("/api/assets")
    expect(inventory.status).toBe(403)

    const name = `E2E-Product ${context.runId}`
    const created = await b2b.post<{ id: string; name: string; code: string | null }>(
      "/api/catalog/products",
      {
        name,
        description: "E2E certification product",
        price: 10,
        currency: "BRL",
      },
    )
    expect([200, 201], created.text.slice(0, 240)).toContain(created.status)
    expect(created.body?.id).toBeTruthy()
    const code = created.body?.code ?? `E2E-${context.runId.slice(-8)}`
    const updated = await b2b.put(`/api/catalog/products/${created.body!.id}`, {
      name: `${name} edit`,
      code,
      description: "E2E certification product edited",
      price: 12,
      currency: "BRL",
    })
    expect(updated.status, updated.text.slice(0, 240)).toBe(200)

    const env = loadE2eEnv()
    const form = new FormData()
    form.append(
      "file",
      new Blob([TINY_PNG], { type: "image/png" }),
      "e2e-pixel.png",
    )
    form.append("visibility", "CustomerVisible")
    const upload = await fetch(
      `${env.apiUrl}/api/catalog/products/${created.body!.id}/files`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${readTokens().b2b}` },
        body: form,
      },
    )
    expect(upload.status, await upload.text().then((text) => text.slice(0, 200))).toBe(200)
  })

  test("Catalog OFF 403s products and orders while siblings stay up", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(
      admin,
      snapshot,
      ["inventory", "rentals", "pmoc", "os"],
      ["spaces", "electrical"],
    )
    await assertRuntimeGates(b2b, ["inventory", "rentals", "pmoc", "os"])
  })
})

test.describe("Catalog B2B UI", () => {
  test.use({ storageState: B2B_STATE })

  test("product list and create dialog render", async ({ page }) => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["catalog"], ["generic"])
    const guards = attachPageGuards(page)
    await page.goto("/catalogo/produtos")
    await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Novo produto" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByLabel("Nome")).toBeVisible()
    await expect(page.getByLabel("Código")).toBeVisible()
    guards.assertNoCrash()
  })
})

test.describe("Catalog B2C + Orders", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2C_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("Customer can browse, change quantity, add to cart and place an order", async ({
    page,
  }) => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["catalog"], ["generic"])

    const name = `E2E-Product ${context.runId}`
    const listed = await b2b.get<Array<{ id: string; name: string }>>(
      "/api/catalog/products",
    )
    const product =
      listed.body?.find((item) => item.name.includes(context.runId)) ??
      (
        await b2b.post<{ id: string; name: string }>("/api/catalog/products", {
          name,
          price: 9,
          currency: "BRL",
        })
      ).body

    expect(product?.id).toBeTruthy()

    const customer = customerClient(snapshot.subdomain)
    const portalProducts = await customer.get("/api/catalog/portal/products")
    expect(portalProducts.status, portalProducts.text.slice(0, 240)).toBe(200)

    const guards = attachPageGuards(page)
    await page.goto(`/t/${snapshot.subdomain}/catalogo`)
    await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(product!.name, { exact: false }).first()).toBeVisible()
    await page.getByRole("button", { name: "Aumentar quantidade" }).first().click()
    await page.getByRole("button", { name: "Adicionar" }).first().click()
    await page.goto(`/t/${snapshot.subdomain}/catalogo/carrinho`)
    await expect(page.getByRole("heading", { name: "Carrinho" })).toBeVisible()
    await page.getByRole("button", { name: "Enviar pedido" }).click()
    await expect(page.getByText(/Pedido enviado/i).first()).toBeVisible({
      timeout: 30_000,
    })

    const orders = await customer.get("/api/catalog/portal/orders")
    expect(orders.status).toBe(200)
    guards.assertNoCrash()
  })

  test("Catalog OFF hides B2C catalog", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])
    const customer = customerClient(snapshot.subdomain)
    const products = await customer.get("/api/catalog/portal/products")
    expect(products.status).toBe(403)
    const orders = await customer.get("/api/catalog/portal/orders")
    expect(orders.status).toBe(403)
  })
})
