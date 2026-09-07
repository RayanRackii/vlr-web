import { test, expect } from "@playwright/test"

import { adminClient, b2bClient } from "../clients"
import { readSnapshot } from "../context"
import { B2B_STATE, B2C_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant } from "../tenant"

const SETTINGS_PATH = "/configuracoes/notificacoes"
const CONFIRMED_WHATSAPP =
  "Ativar WhatsApp para Reserva confirmada"
const CATALOG_EMAIL = "Ativar E-mail para Pedido criado"

test.describe("Unified notification settings", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2B_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("B2B can persist Rentals WhatsApp and Catalog Email toggles", async ({
    page,
  }) => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(
      admin,
      snapshot,
      ["rentals", "catalog"],
      ["spaces"],
    )

    const listed = await b2b.get("/api/notifications/channel-configs")
    expect(
      listed.status,
      `GET /api/notifications/channel-configs expected 200, got ${listed.status}. Unified notifications API may not be deployed on DEV yet.`,
    ).toBe(200)

    const guards = attachPageGuards(page)
    await page.goto(SETTINGS_PATH)
    await expect(
      page.getByRole("heading", { name: "Notificações" }),
    ).toBeVisible({ timeout: 30_000 })

    const rentalsSwitch = page.getByRole("switch", {
      name: CONFIRMED_WHATSAPP,
    })
    await expect(rentalsSwitch).toBeVisible({ timeout: 30_000 })

    if ((await rentalsSwitch.getAttribute("aria-checked")) !== "true") {
      await rentalsSwitch.click()
    }
    await expect(rentalsSwitch).toHaveAttribute("aria-checked", "true")

    await page.reload()
    await expect(
      page.getByRole("switch", { name: CONFIRMED_WHATSAPP }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 30_000 })

    await page.getByRole("switch", { name: CONFIRMED_WHATSAPP }).click()
    await expect(
      page.getByRole("switch", { name: CONFIRMED_WHATSAPP }),
    ).toHaveAttribute("aria-checked", "false")

    await page.reload()
    await expect(
      page.getByRole("switch", { name: CONFIRMED_WHATSAPP }),
    ).toHaveAttribute("aria-checked", "false", { timeout: 30_000 })

    const catalogSwitch = page.getByRole("switch", { name: CATALOG_EMAIL })
    if ((await catalogSwitch.count()) > 0) {
      await expect(catalogSwitch).toBeVisible()
      if ((await catalogSwitch.getAttribute("aria-checked")) !== "true") {
        await catalogSwitch.click()
      }
      await expect(catalogSwitch).toHaveAttribute("aria-checked", "true")
      await page.reload()
      await expect(
        page.getByRole("switch", { name: CATALOG_EMAIL }),
      ).toHaveAttribute("aria-checked", "true", { timeout: 30_000 })
      await page.getByRole("switch", { name: CATALOG_EMAIL }).click()
      await expect(
        page.getByRole("switch", { name: CATALOG_EMAIL }),
      ).toHaveAttribute("aria-checked", "false")
    }

    guards.assertNoCrash()
  })
})

test.describe("Customer cannot open tenant notification settings", () => {
  test.use({ storageState: B2C_STATE })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("B2C session does not get the admin settings page", async ({ page }) => {
    const guards = attachPageGuards(page)
    await page.goto(SETTINGS_PATH)
    await expect(
      page.getByText("Escolha os canais de aviso por evento", { exact: false }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("switch", { name: CONFIRMED_WHATSAPP }),
    ).toHaveCount(0)
    guards.assertNoCrash()
  })
})
