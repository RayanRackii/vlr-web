import { expect, test, type Page, type Response } from "@playwright/test"

import { adminClient, b2bClient } from "../clients"
import { readSnapshot } from "../context"
import { B2B_STATE, B2C_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import { applyCommercialModules, restoreTenant } from "../tenant"

const SETTINGS_PATH = "/configuracoes/notificacoes"
const CONFIRMED_WHATSAPP = "Ativar WhatsApp para Reserva confirmada"
const CATALOG_EMAIL = "Ativar E-mail para Pedido criado"
const CHANNEL_CONFIGS_PATH = "/api/notifications/channel-configs"

function isChannelConfigPut(response: Response): boolean {
  return (
    response.request().method() === "PUT" &&
    response.url().includes(CHANNEL_CONFIGS_PATH)
  )
}

async function persistSwitch(
  page: Page,
  switchName: string,
  wantChecked: boolean,
): Promise<void> {
  const control = page.getByRole("switch", { name: switchName })
  await expect(control).toBeVisible({ timeout: 30_000 })

  const currentlyChecked =
    (await control.getAttribute("aria-checked")) === "true"
  if (currentlyChecked === wantChecked) {
    return
  }

  const persisted = page.waitForResponse(isChannelConfigPut, {
    timeout: 30_000,
  })
  await control.click()
  const response = await persisted
  expect(
    response.ok(),
    `PUT ${CHANNEL_CONFIGS_PATH} expected 2xx, got ${response.status()}`,
  ).toBe(true)

  const payload = (await response.json()) as { isActive?: unknown }
  expect(payload.isActive).toBe(wantChecked)
  await expect(control).toHaveAttribute(
    "aria-checked",
    String(wantChecked),
  )
}

async function reloadAndAssertSwitch(
  page: Page,
  switchName: string,
  wantChecked: boolean,
): Promise<void> {
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Notificações" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole("switch", { name: switchName }),
  ).toHaveAttribute("aria-checked", String(wantChecked), {
    timeout: 30_000,
  })
}

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

    await persistSwitch(page, CONFIRMED_WHATSAPP, true)
    await reloadAndAssertSwitch(page, CONFIRMED_WHATSAPP, true)
    await persistSwitch(page, CONFIRMED_WHATSAPP, false)
    await reloadAndAssertSwitch(page, CONFIRMED_WHATSAPP, false)

    const catalogSwitch = page.getByRole("switch", { name: CATALOG_EMAIL })
    if ((await catalogSwitch.count()) > 0) {
      await persistSwitch(page, CATALOG_EMAIL, true)
      await reloadAndAssertSwitch(page, CATALOG_EMAIL, true)
      await persistSwitch(page, CATALOG_EMAIL, false)
      await reloadAndAssertSwitch(page, CATALOG_EMAIL, false)
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
      page.getByText("Escolha os canais de aviso por evento", {
        exact: false,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("switch", { name: CONFIRMED_WHATSAPP }),
    ).toHaveCount(0)
    guards.assertNoCrash()
  })
})
