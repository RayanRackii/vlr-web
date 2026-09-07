import { test, expect } from "@playwright/test"

import type { ApiClient } from "../api-client"
import { adminClient, b2bClient, customerClient, publicClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2C_STATE } from "../env"
import { categoryByName, familyByKey, firstUnit } from "../lookups"
import { attachPageGuards } from "../page-errors"
import {
  addDaysIso,
  ensureBookableDay,
  openAgendaOnDate,
  saoPauloWallClock,
  selectLocationOnAgenda,
  type QueuedLocation,
} from "../queue"
import { applyCommercialModules, restoreTenant } from "../tenant"

test.describe("B2C self-cancel", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2C_STATE })

  let location: QueuedLocation | null = null
  let bookDate: string
  let bookWindow: { startTime: string; endTime: string }

  test.beforeAll(async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    location = await createBookableLocation(b2b, {
      name: `E2E Self Cancel ${context.runId}`,
      tag: `E2E-SC-${context.runId.slice(-8)}`,
    })
    bookDate = addDaysIso(saoPauloWallClock().date, 1)
    bookWindow = await ensureBookableDay(
      b2b,
      publicClient(snapshot.subdomain),
      snapshot.subdomain,
      location,
      bookDate,
    )
  })

  test.afterAll(async () => {
    const snapshot = readSnapshot()
    await cleanupCreatedLocation(
      b2bClient(),
      customerClient(snapshot.subdomain),
      location,
    )
    await restoreTenant(adminClient(), snapshot)
  }, { timeout: 180_000 })

  test("Customer books a future slot, cancels it, and the slot is free again", async ({
    page,
  }) => {
    expect(location).toBeTruthy()
    const booked = location!
    const snapshot = readSnapshot()
    const hhmm = bookWindow.startTime.slice(0, 5)
    const guards = attachPageGuards(page)

    await openAgendaOnDate(page, snapshot.subdomain, bookDate, booked.name)
    await selectLocationOnAgenda(page, booked.name, bookWindow.startTime)

    const reserve = page.getByRole("button", { name: "Reservar horário" })
    await expect(reserve).toBeEnabled({ timeout: 15_000 })
    await reserve.click()
    await expect(page.getByText("Reserva criada!")).toBeVisible({
      timeout: 20_000,
    })

    const mineRow = page
      .locator("li")
      .filter({ hasText: booked.name })
      .filter({ hasText: hhmm })
      .first()
    await expect(mineRow).toBeVisible()
    const cancel = mineRow.getByRole("button", { name: "Cancelar" })
    await expect(cancel).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Concluir" }),
    ).toHaveCount(0)

    await cancel.click()
    await expect(page.getByText("Reserva cancelada.")).toBeVisible({
      timeout: 20_000,
    })
    await expect(mineRow.getByRole("button", { name: "Cancelar" })).toHaveCount(
      0,
    )
    await expect(
      mineRow
        .getByText(/Cancelada/)
        .or(page.getByText("Nenhuma reserva ainda.")),
    ).toBeVisible()

    const customer = customerClient(snapshot.subdomain)
    const mine = await customer.get<
      Array<{
        id: string
        status: string
        items: Array<{ assetName: string; rentalAssetId?: string }>
      }>
    >("/api/reservations/mine")
    expect(mine.status).toBe(200)
    const created = mine.body?.find((row) =>
      row.items.some(
        (item) =>
          item.assetName === booked.name || item.rentalAssetId === booked.id,
      ),
    )
    if (created) {
      expect(created.status).toBe("Canceled")
    }

    const day = await publicClient(snapshot.subdomain).get<{
      slots?: Array<{
        rentalAssetId: string
        startTime: string
        status: string
        isBookableByCustomer?: boolean
      }>
    }>(`/api/public/tenants/${snapshot.subdomain}/schedule/days/${bookDate}`)
    expect(day.status, day.text.slice(0, 240)).toBe(200)
    const slot = (day.body?.slots ?? []).find(
      (entry) =>
        entry.rentalAssetId === booked.id &&
        entry.startTime.startsWith(hhmm),
    )
    expect(slot, "canceled reservation should free the slot").toBeTruthy()
    expect(slot!.status.toLowerCase()).toBe("available")
    expect(slot!.isBookableByCustomer).not.toBe(false)

    await selectLocationOnAgenda(page, booked.name, bookWindow.startTime)
    await expect(reserve).toBeEnabled()
    guards.assertNoCrash()
  })
})

async function createBookableLocation(
  b2b: ApiClient,
  options: { name: string; tag: string },
): Promise<QueuedLocation> {
  const unit = await firstUnit(b2b)
  const family = await familyByKey(b2b, "spaces")
  const category = await categoryByName(b2b, "Quadra")

  const created = await b2b.post<{
    id: string
    assetId: string
    unitId: string
    name: string
  }>("/api/rental-assets", {
    name: options.name,
    tag: options.tag,
    unitId: unit.id,
    categoryId: category.id,
    familyId: family.id,
    rentalType: "Location",
    totalQuantity: 1,
    requiresDeposit: false,
    queueEnabled: false,
    queueOpeningTime: null,
    location: null,
  })
  expect(created.status, created.text.slice(0, 240)).toBe(201)
  const body = created.body
  expect(body?.id).toBeTruthy()

  const policy = await b2b.put(`/api/rental-assets/${body!.id}/schedule-policy`, {
    schedulePolicy: "OpenHours",
    openTime: "08:00:00",
    closeTime: "22:00:00",
    allowedDurationMinutes: "60",
  })
  expect(policy.status, policy.text.slice(0, 240)).toBe(200)

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ] as const
  const pricing = await b2b.post("/api/assets/pricing-bulk", {
    assetIds: [body!.assetId],
    replace: true,
    pricings: days.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: "08:00:00",
      endTime: "22:00:00",
      pricePerHour: 10,
      requiresDeposit: false,
      depositPercentage: 0,
    })),
  })
  expect(pricing.status, pricing.text.slice(0, 240)).toBe(200)

  return {
    id: body!.id,
    assetId: body!.assetId,
    unitId: body!.unitId,
    name: body!.name,
    queueOpeningTime: "",
  }
}

async function cleanupCreatedLocation(
  b2b: ApiClient,
  customer: ApiClient,
  created: QueuedLocation | null | undefined,
): Promise<void> {
  if (!created) {
    return
  }

  const listed = await b2b.get<Array<{ id: string; status?: string }>>(
    `/api/reservations?assetId=${created.assetId}`,
  )
  if (listed.status === 200 && Array.isArray(listed.body)) {
    for (const reservation of listed.body) {
      if (
        reservation.status === "Canceled" ||
        reservation.status === "Cancelled"
      ) {
        continue
      }
      const asCustomer = await customer.post(
        `/api/reservations/mine/${reservation.id}/cancel`,
      )
      if (asCustomer.status !== 200) {
        await b2b.post(`/api/reservations/${reservation.id}/cancel`)
      }
    }
  }

  await b2b.delete(`/api/assets/${created.assetId}`)
  await b2b.delete(`/api/assets/${created.assetId}`)
}
