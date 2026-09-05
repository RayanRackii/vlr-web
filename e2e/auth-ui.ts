import type { Page } from "@playwright/test"

import { attachPageGuards } from "./page-errors"

export async function loginB2b(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const guards = attachPageGuards(page)
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Senha").fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 30_000 })
  guards.assertNoCrash()
}

export async function loginCustomerUi(
  page: Page,
  slug: string,
  email: string,
  password: string,
): Promise<void> {
  const guards = attachPageGuards(page)
  await page.goto(`/t/${slug}`)
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Senha").fill(password)
  await page.getByRole("button", { name: /entrar/i }).click()
  await page.waitForURL(new RegExp(`/t/${slug}/app`), { timeout: 30_000 })
  guards.assertNoCrash()
}
