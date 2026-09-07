import { test, expect } from "@playwright/test"

import { adminClient, b2bClient, customerClient, publicClient } from "../clients"
import { readContext, readSnapshot } from "../context"
import { B2C_STATE } from "../env"
import { attachPageGuards } from "../page-errors"
import {
  addDaysIso,
  cleanupQueuedLocations,
  createQueuedLocation,
  ensureBookableDay,
  formatBrazilClock,
  getQueue,
  isSafeClosedPhaseWindow,
  isSafeOpenPhaseWindow,
  joinQueue,
  openAgendaOnDate,
  queueError,
  sameInstant,
  saoPauloWallClock,
  selectLocationOnAgenda,
  type QueuedLocation,
} from "../queue"
import { applyCommercialModules, restoreTenant } from "../tenant"

test.describe("Rentals queue E2E", () => {
  test.describe.configure({ mode: "serial" })

  let closedLocation: QueuedLocation | null = null
  let waitingLocation: QueuedLocation
  let openLocation: QueuedLocation | null = null
  let disabledLocation: QueuedLocation | null = null
  let bookDate: string
  let bookWindow: { startTime: string; endTime: string }

  test.beforeAll(async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    const suffix = context.runId.slice(-8)
    if (isSafeClosedPhaseWindow()) {
      closedLocation = await createQueuedLocation(b2b, {
        name: `E2E Queue Closed ${context.runId}`,
        tag: `E2E-QC-${suffix}`,
        phase: "Closed",
      })
    }
    waitingLocation = await createQueuedLocation(b2b, {
      name: `E2E Queue Wait ${context.runId}`,
      tag: `E2E-QW-${suffix}`,
      phase: "WaitingRoom",
    })

    if (isSafeOpenPhaseWindow()) {
      openLocation = await createQueuedLocation(b2b, {
        name: `E2E Queue Open ${context.runId}`,
        tag: `E2E-QO-${suffix}`,
        phase: "Open",
      })
    }

    bookDate = addDaysIso(saoPauloWallClock().date, 1)
    const bookTarget = openLocation ?? waitingLocation
    bookWindow = await ensureBookableDay(
      b2b,
      publicClient(snapshot.subdomain),
      snapshot.subdomain,
      bookTarget,
      bookDate,
    )
    await ensureBookableDay(
      b2b,
      publicClient(snapshot.subdomain),
      snapshot.subdomain,
      waitingLocation,
      bookDate,
    )
    if (closedLocation) {
      await ensureBookableDay(
        b2b,
        publicClient(snapshot.subdomain),
        snapshot.subdomain,
        closedLocation,
        bookDate,
      )
    }
  })

  test.afterAll(async () => {
    const snapshot = readSnapshot()
    await cleanupQueuedLocations(
      b2bClient(),
      customerClient(snapshot.subdomain),
      [closedLocation, waitingLocation, openLocation, disabledLocation],
    )
    await restoreTenant(adminClient(), snapshot)
  }, { timeout: 180_000 })

  test("unauthenticated and staff cannot use Customer queue routes", async () => {
    const snapshot = readSnapshot()
    const anonymous = publicClient(snapshot.subdomain)
    const staff = b2bClient()
    const asAnonymous = await getQueue(anonymous, waitingLocation.id)
    expect([401, 403], queueError(asAnonymous)).toContain(asAnonymous.status)

    const asStaff = await getQueue(staff, waitingLocation.id)
    expect([401, 403], queueError(asStaff)).toContain(asStaff.status)
  })

  test("queue-disabled Location is not a queue resource", async () => {
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    const unit = (
      await b2b.get<Array<{ id: string }>>("/api/units")
    ).body?.[0]
    expect(unit?.id).toBeTruthy()
    const created = await b2b.post<{
      id: string
      assetId: string
      unitId: string
      name: string
    }>("/api/rental-assets", {
      name: `E2E Queue Off ${context.runId}`,
      tag: `E2E-QOFF-${context.runId.slice(-8)}`,
      unitId: unit!.id,
      categoryId: (await b2b.get<Array<{ id: string; name: string }>>(
        "/api/rental-assets/categories",
      )).body?.find((item) => item.name === "Quadra")?.id,
      familyId: (await b2b.get<Array<{ id: string; key?: string }>>(
        "/api/rental-assets/families",
      )).body?.find((item) => item.key === "spaces")?.id,
      rentalType: "Location",
      totalQuantity: 1,
      requiresDeposit: false,
      queueEnabled: false,
      queueOpeningTime: null,
      location: null,
    })
    expect(created.status, created.text.slice(0, 240)).toBe(201)
    disabledLocation = {
      id: created.body!.id,
      assetId: created.body!.assetId,
      unitId: created.body!.unitId,
      name: created.body!.name,
      queueOpeningTime: "",
    }

    const missing = await getQueue(
      customerClient(snapshot.subdomain),
      created.body!.id,
    )
    expect(missing.status, queueError(missing)).toBe(404)
  })

  test("Closed phase rejects join with QUEUE_WAITING_ROOM_CLOSED", async () => {
    test.skip(
      !closedLocation || !isSafeClosedPhaseWindow(),
      "São Paulo wall clock is too close to midnight for a same-day Closed opening.",
    )
    const customer = customerClient(readSnapshot().subdomain)
    const status = await getQueue(customer, closedLocation!.id)
    expect(status.status, queueError(status)).toBe(200)
    expect(status.body?.queueEnabled).toBe(true)
    expect(status.body?.phase).toBe("Closed")
    expect(status.body?.myTicket).toBeNull()
    expect(status.body?.opensAt).toBeTruthy()
    expect(status.body?.waitingRoomOpensAt).toBeTruthy()
    expect(status.body?.serverNow).toBeTruthy()

    const joined = await joinQueue(customer, closedLocation!.id)
    expect(joined.status, queueError(joined)).toBe(400)
    expect(queueError(joined)).toBe("QUEUE_WAITING_ROOM_CLOSED")
  })

  test("Customer joins WaitingRoom, duplicate join is idempotent, reload keeps ticket", async () => {
    const customer = customerClient(readSnapshot().subdomain)
    const first = await joinQueue(customer, waitingLocation.id)
    expect(first.status, queueError(first)).toBe(200)
    expect(first.body?.phase).toBe("WaitingRoom")
    expect(first.body?.myTicket?.status).toBe("Waiting")
    expect(first.body?.myTicket?.position).toBeGreaterThan(0)
    const ticketId = first.body?.myTicket?.id
    expect(ticketId).toBeTruthy()

    const duplicate = await joinQueue(customer, waitingLocation.id)
    expect(duplicate.status, queueError(duplicate)).toBe(200)
    expect(duplicate.body?.myTicket?.id).toBe(ticketId)
    expect(duplicate.body?.myTicket?.status).toBe("Waiting")

    const again = await getQueue(customer, waitingLocation.id)
    expect(again.status, queueError(again)).toBe(200)
    expect(again.body?.myTicket?.id).toBe(ticketId)
    expect(again.body?.myTicket?.status).toBe("Waiting")
    expect(again.body?.aheadCount).toBeGreaterThanOrEqual(0)
  })

  test("waiting Customer cannot book (QUEUE_WAITING)", async () => {
    const snapshot = readSnapshot()
    const customer = customerClient(snapshot.subdomain)
    const booked = await customer.post("/api/reservations", {
      unitId: waitingLocation.unitId,
      date: bookDate,
      startTime: bookWindow.startTime,
      endTime: bookWindow.endTime,
      items: [{ assetId: waitingLocation.assetId, quantity: 1 }],
    })
    expect(booked.status, booked.text.slice(0, 240)).toBe(409)
    expect(queueError(booked)).toBe("QUEUE_WAITING")
  })

  test("Open phase: join becomes Active, booking creates Reservation, occupancy blocks reuse", async () => {
    test.skip(
      !openLocation || !isSafeOpenPhaseWindow(),
      "São Paulo wall clock is inside the midnight waiting-room wrap; Open→Active is not unambiguous.",
    )
    const location = openLocation!
    const snapshot = readSnapshot()
    const customer = customerClient(snapshot.subdomain)
    const window = await ensureBookableDay(
      b2bClient(),
      publicClient(snapshot.subdomain),
      snapshot.subdomain,
      location,
      bookDate,
    )

    const joined = await joinQueue(customer, location.id)
    expect(joined.status, queueError(joined)).toBe(200)
    expect(joined.body?.phase).toBe("Open")
    expect(joined.body?.myTicket?.status).toBe("Active")
    expect(joined.body?.myTicket?.turnExpiresAt).toBeTruthy()
    const ticketId = joined.body?.myTicket?.id

    const reconnect = await getQueue(customer, location.id)
    expect(reconnect.body?.myTicket?.id).toBe(ticketId)
    expect(reconnect.body?.myTicket?.status).toBe("Active")
    expect(
      sameInstant(
        reconnect.body?.myTicket?.turnExpiresAt,
        joined.body?.myTicket?.turnExpiresAt,
      ),
    ).toBe(true)

    const created = await customer.post<{
      id: string
      startDateTime: string
      endDateTime: string
      status: string
      items: Array<{ assetName: string }>
    }>("/api/reservations", {
      unitId: location.unitId,
      date: bookDate,
      startTime: window.startTime,
      endTime: window.endTime,
      items: [{ assetId: location.assetId, quantity: 1 }],
    })
    expect(created.status, created.text.slice(0, 240)).toBe(201)
    expect(created.body?.id).toBeTruthy()
    expect(["Confirmed", "PendingDeposit"]).toContain(created.body?.status)

    const startClock = formatBrazilClock(created.body!.startDateTime)
    expect(startClock).toBe(window.startTime.slice(0, 5))

    const completed = await getQueue(customer, location.id)
    expect(completed.status, queueError(completed)).toBe(200)
    expect(completed.body?.myTicket?.status).toBe("Completed")
    expect(completed.body?.myTicket?.completedReservationId).toBe(created.body?.id)

    const reuse = await customer.post("/api/reservations", {
      unitId: location.unitId,
      date: bookDate,
      startTime: window.startTime,
      endTime: window.endTime,
      items: [{ assetId: location.assetId, quantity: 1 }],
    })
    expect(reuse.status, reuse.text.slice(0, 240)).toBeGreaterThanOrEqual(400)
    const reuseCode = queueError(reuse)
    expect(
      ["QUEUE_TURN_ALREADY_USED", "QUEUE_REQUIRED"].includes(reuseCode) ||
        reuse.status === 409,
    ).toBe(true)

    const mine = await customer.get<
      Array<{ id: string; startDateTime: string }>
    >("/api/reservations/mine")
    expect(mine.status).toBe(200)
    expect(mine.body?.some((row) => row.id === created.body?.id)).toBe(true)
  })

  test("Rentals module off returns 403 on queue", async () => {
    const admin = adminClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["catalog"], ["generic"])
    const blocked = await getQueue(
      customerClient(snapshot.subdomain),
      waitingLocation.id,
    )
    expect(blocked.status, queueError(blocked)).toBe(403)
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])
  })
})

test.describe("Rentals queue B2C UI", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: B2C_STATE })

  let waitingLocation: QueuedLocation
  let closedLocation: QueuedLocation | null = null
  let openLocation: QueuedLocation | null = null
  let bookDate: string
  let bookWindow: { startTime: string; endTime: string }

  test.beforeAll(async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    const context = readContext()
    await applyCommercialModules(admin, snapshot, ["rentals"], ["spaces"])

    const suffix = `UI${context.runId.slice(-6)}`
    if (isSafeClosedPhaseWindow()) {
      closedLocation = await createQueuedLocation(b2b, {
        name: `E2E Queue UI Closed ${context.runId}`,
        tag: `E2E-UC-${suffix}`.slice(0, 32),
        phase: "Closed",
      })
    }
    waitingLocation = await createQueuedLocation(b2b, {
      name: `E2E Queue UI Wait ${context.runId}`,
      tag: `E2E-UW-${suffix}`.slice(0, 32),
      phase: "WaitingRoom",
    })
    if (isSafeOpenPhaseWindow()) {
      openLocation = await createQueuedLocation(b2b, {
        name: `E2E Queue UI Open ${context.runId}`,
        tag: `E2E-UO-${suffix}`.slice(0, 32),
        phase: "Open",
      })
    }
    bookDate = addDaysIso(saoPauloWallClock().date, 1)
    const publicApi = publicClient(snapshot.subdomain)
    bookWindow = await ensureBookableDay(
      b2b,
      publicApi,
      snapshot.subdomain,
      waitingLocation,
      bookDate,
    )
    await ensureBookableDay(b2b, publicApi, snapshot.subdomain, waitingLocation, bookDate)
    if (closedLocation) {
      await ensureBookableDay(b2b, publicApi, snapshot.subdomain, closedLocation, bookDate)
    }
    if (openLocation) {
      bookWindow = await ensureBookableDay(
        b2b,
        publicApi,
        snapshot.subdomain,
        openLocation,
        bookDate,
      )
    }
  })

  test.afterAll(async () => {
    const snapshot = readSnapshot()
    await cleanupQueuedLocations(
      b2bClient(),
      customerClient(snapshot.subdomain),
      [closedLocation, waitingLocation, openLocation],
    )
    await restoreTenant(adminClient(), snapshot)
  }, { timeout: 180_000 })

  test("Closed queue UI shows Brazil opening clocks and hides reserve", async ({
    page,
  }) => {
    test.skip(
      !closedLocation || !isSafeClosedPhaseWindow(),
      "São Paulo wall clock is too close to midnight for a same-day Closed opening.",
    )
    const snapshot = readSnapshot()
    const customer = customerClient(snapshot.subdomain)
    const status = await getQueue(customer, closedLocation!.id)
    expect(status.body?.phase).toBe("Closed")
    const waitingRoomClock = formatBrazilClock(status.body!.waitingRoomOpensAt)
    const opensClock = formatBrazilClock(status.body!.opensAt)

    const guards = attachPageGuards(page)
    await openAgendaOnDate(page, snapshot.subdomain, bookDate, closedLocation!.name)
    await selectLocationOnAgenda(page, closedLocation!.name, bookWindow.startTime)
    await expect(page.getByText(/A fila abre às/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(waitingRoomClock)).toBeVisible()
    await expect(page.getByText(opensClock)).toBeVisible()
    await expect(page.getByRole("button", { name: "Entrar na fila" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Reservar horário" })).toBeDisabled()
    guards.assertNoCrash()
  })

  test("join waiting UI survives reload without duplicating the ticket", async ({
    page,
  }) => {
    const snapshot = readSnapshot()
    const customer = customerClient(snapshot.subdomain)
    const guards = attachPageGuards(page)
    await openAgendaOnDate(page, snapshot.subdomain, bookDate, waitingLocation.name)
    await selectLocationOnAgenda(page, waitingLocation.name, bookWindow.startTime)
    await expect(page.getByRole("button", { name: "Entrar na fila" })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: "Entrar na fila" }).click()
    await expect(page.getByText("Você está na fila")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Sua posição:/)).toBeVisible()

    const before = await getQueue(customer, waitingLocation.id)
    const ticketId = before.body?.myTicket?.id
    expect(ticketId).toBeTruthy()

    await page.reload()
    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 30_000 })
    await page.locator('input[type="date"]').fill(bookDate)
    await selectLocationOnAgenda(page, waitingLocation.name, bookWindow.startTime)
    await expect(page.getByText("Você está na fila")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("button", { name: "Reservar horário" })).toBeDisabled()

    const after = await getQueue(customer, waitingLocation.id)
    expect(after.body?.myTicket?.id).toBe(ticketId)
    expect(after.body?.myTicket?.status).toBe("Waiting")
    guards.assertNoCrash()
  })

  test("active turn enables booking and reservation clock stays São Paulo civil", async ({
    page,
  }) => {
    test.skip(
      !openLocation || !isSafeOpenPhaseWindow(),
      "São Paulo wall clock is inside the midnight waiting-room wrap; Open→Active is not unambiguous.",
    )
    const location = openLocation!
    const snapshot = readSnapshot()
    const guards = attachPageGuards(page)
    await openAgendaOnDate(page, snapshot.subdomain, bookDate, location.name)
    await selectLocationOnAgenda(page, location.name, bookWindow.startTime)
    const join = page.getByRole("button", { name: "Entrar na fila" })
    const yourTurn = page.getByText("Sua vez")
    await expect(join.or(yourTurn)).toBeVisible({ timeout: 15_000 })
    if (await join.isVisible()) {
      await join.click()
    }
    await expect(yourTurn).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Tempo restante:/)).toBeVisible()
    const reserve = page.getByRole("button", { name: "Reservar horário" })
    await expect(reserve).toBeEnabled()
    await reserve.click()
    await expect(page.getByText("Reserva criada!")).toBeVisible({ timeout: 20_000 })
    const hhmm = bookWindow.startTime.slice(0, 5)
    const mineRow = page
      .locator("li")
      .filter({ hasText: location.name })
      .filter({ hasText: hhmm })
      .first()
    await expect(mineRow).toBeVisible()
    guards.assertNoCrash()
  })
})

test.describe("Rentals queue unauthenticated UI", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("unauthenticated agenda redirects to portal login", async ({ page }) => {
    const snapshot = readSnapshot()
    await page.goto(`/t/${snapshot.subdomain}/agenda`)
    await expect(page).toHaveURL(new RegExp(`/t/${snapshot.subdomain}/?$`))
    await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 15_000 })
  })
})
