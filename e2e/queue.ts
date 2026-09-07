import { expect, type Page } from "@playwright/test"

import type { ApiClient, ApiResult } from "./api-client"
import { categoryByName, familyByKey, firstUnit } from "./lookups"

export const SAO_PAULO_TZ = "America/Sao_Paulo"

export type QueuePhase = "Closed" | "WaitingRoom" | "Open"

export type QueueTicketStatus =
  | "Waiting"
  | "Active"
  | "Completed"
  | "Expired"
  | "Cancelled"

export type QueueTicket = {
  id: string
  status: QueueTicketStatus
  sequence: number
  position: number
  joinedAt: string
  turnStartedAt: string | null
  turnExpiresAt: string | null
  completedReservationId: string | null
}

export type QueueStatus = {
  rentalAssetId: string
  queueEnabled: boolean
  openingDate: string
  opensAt: string
  waitingRoomOpensAt: string
  serverNow: string
  phase: QueuePhase
  waitingCount: number
  aheadCount: number
  myTicket: QueueTicket | null
}

export type QueuedLocation = {
  id: string
  assetId: string
  unitId: string
  name: string
  queueOpeningTime: string
}

type SaoPauloWall = {
  date: string
  hour: number
  minute: number
  hhmmss: string
  minutesFromMidnight: number
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function saoPauloWallClock(now = new Date()): SaoPauloWall {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ""

  const hour = Number(read("hour"))
  const minute = Number(read("minute"))
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    hour,
    minute,
    hhmmss: `${pad2(hour)}:${pad2(minute)}:00`,
    minutesFromMidnight: hour * 60 + minute,
  }
}

export function addMinutesSaoPaulo(minutes: number, now = new Date()): SaoPauloWall {
  return saoPauloWallClock(new Date(now.getTime() + minutes * 60_000))
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const utc = Date.UTC(year, month - 1, day + days)
  return new Date(utc).toISOString().slice(0, 10)
}

/** Open-phase join→Active is unambiguous after 00:30 São Paulo. */
export function isSafeOpenPhaseWindow(now = new Date()): boolean {
  return saoPauloWallClock(now).minutesFromMidnight >= 30
}

/** Closed phase needs T still on this São Paulo civil day (no midnight wrap). */
export function isSafeClosedPhaseWindow(now = new Date()): boolean {
  return saoPauloWallClock(now).minutesFromMidnight + 50 < 24 * 60
}

/**
 * Minutes until TimeOnly T on the São Paulo wall. A wrap to 00:xx while still
 * before midnight is next-day T (ResolveOpeningDate). After T has passed the
 * same civil morning, remaining is negative (Open) — do not add 24h.
 */
export function minutesUntilOpening(openingTime: string, now = new Date()): number {
  const wall = saoPauloWallClock(now)
  const [hour, minute] = openingTime.split(":").map(Number)
  let remaining = hour * 60 + minute - wall.minutesFromMidnight
  if (remaining < -12 * 60) {
    remaining += 24 * 60
  }
  return remaining
}

/** Skip WaitingRoom assertions when a slow serial describe could drift into Open. */
export function isWaitingRoomStillOpen(
  openingTime: string,
  now = new Date(),
): boolean {
  return minutesUntilOpening(openingTime, now) >= 8
}

export function openingTimeForPhase(phase: QueuePhase, now = new Date()): string {
  if (phase === "Open") {
    const wall = saoPauloWallClock(now)
    if (wall.minutesFromMidnight >= 23 * 60 + 30) {
      return "23:00:00"
    }
    return "00:00:00"
  }
  if (phase === "WaitingRoom") {
    return addMinutesSaoPaulo(25, now).hhmmss
  }
  return addMinutesSaoPaulo(45, now).hhmmss
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function toTimeOnly(value: string): string {
  const hhmm = value.slice(0, 5)
  return `${hhmm}:00`
}

export function queueError(result: ApiResult<{ error?: string }>): string {
  return result.body?.error ?? result.text.slice(0, 240)
}

export async function createQueuedLocation(
  b2b: ApiClient,
  options: {
    name: string
    tag: string
    phase: QueuePhase
  },
): Promise<QueuedLocation> {
  const unit = await firstUnit(b2b)
  const family = await familyByKey(b2b, "spaces")
  const category = await categoryByName(b2b, "Quadra")
  const queueOpeningTime = openingTimeForPhase(options.phase)

  const created = await b2b.post<{
    id: string
    assetId: string
    unitId: string
    name: string
    queueEnabled: boolean
    queueOpeningTime: string | null
  }>("/api/rental-assets", {
    name: options.name,
    tag: options.tag,
    unitId: unit.id,
    categoryId: category.id,
    familyId: family.id,
    rentalType: "Location",
    totalQuantity: 1,
    requiresDeposit: false,
    queueEnabled: true,
    queueOpeningTime,
    location: null,
  })
  expect(created.status, created.text.slice(0, 240)).toBe(201)
  const body = created.body
  expect(body?.id).toBeTruthy()
  expect(body?.queueEnabled).toBe(true)

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
    queueOpeningTime,
  }
}

export async function ensureBookableDay(
  b2b: ApiClient,
  publicApi: ApiClient,
  subdomain: string,
  location: QueuedLocation,
  date: string,
): Promise<{ startTime: string; endTime: string }> {
  const day = await publicApi.get<{
    slots?: Array<{
      rentalAssetId: string
      startTime: string
      endTime: string
      isBookableByCustomer?: boolean
    }>
  }>(`/api/public/tenants/${subdomain}/schedule/days/${date}`)
  expect(day.status, day.text.slice(0, 240)).toBe(200)

  const slots = (day.body?.slots ?? []).filter(
    (slot) =>
      slot.rentalAssetId === location.id && slot.isBookableByCustomer !== false,
  )
  const preferred =
    slots.find((slot) => slot.startTime.startsWith("10:00")) ?? slots[0]
  if (preferred) {
    return {
      startTime: toTimeOnly(preferred.startTime),
      endTime: toTimeOnly(preferred.endTime),
    }
  }

  const seeded = await b2b.post("/api/schedule/templates/seed-default", {
    rentalAssetId: location.id,
    openTime: "08:00:00",
    closeTime: "22:00:00",
    slotMinutes: 60,
  })
  expect([200, 201], seeded.text.slice(0, 240)).toContain(seeded.status)

  const again = await publicApi.get<{
    slots?: Array<{
      rentalAssetId: string
      startTime: string
      endTime: string
      isBookableByCustomer?: boolean
    }>
  }>(`/api/public/tenants/${subdomain}/schedule/days/${date}`)
  expect(again.status, again.text.slice(0, 240)).toBe(200)
  const fallback = (again.body?.slots ?? []).find(
    (slot) => slot.rentalAssetId === location.id,
  )
  expect(fallback, "queue location should expose a bookable window").toBeTruthy()
  return {
    startTime: toTimeOnly(fallback!.startTime),
    endTime: toTimeOnly(fallback!.endTime),
  }
}

export async function getQueue(
  customer: ApiClient,
  rentalAssetId: string,
): Promise<ApiResult<QueueStatus>> {
  return customer.get<QueueStatus>(`/api/rental-assets/${rentalAssetId}/queue`)
}

export async function joinQueue(
  customer: ApiClient,
  rentalAssetId: string,
): Promise<ApiResult<QueueStatus>> {
  return customer.post<QueueStatus>(
    `/api/rental-assets/${rentalAssetId}/queue/join`,
  )
}

export async function leaveQueue(
  customer: ApiClient,
  rentalAssetId: string,
): Promise<ApiResult<QueueStatus>> {
  return customer.post<QueueStatus>(
    `/api/rental-assets/${rentalAssetId}/queue/leave`,
  )
}

export function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) {
    return left === right
  }
  return Date.parse(left) === Date.parse(right)
}

export async function cleanupQueuedLocations(
  b2b: ApiClient,
  customer: ApiClient,
  locations: Array<QueuedLocation | null | undefined>,
): Promise<void> {
  for (const location of locations) {
    if (!location) {
      continue
    }
    await leaveQueue(customer, location.id)
    const listed = await b2b.get<Array<{ id: string; status?: string }>>(
      `/api/reservations?assetId=${location.assetId}`,
    )
    if (listed.status === 200 && Array.isArray(listed.body)) {
      for (const reservation of listed.body) {
        if (
          reservation.status === "Canceled" ||
          reservation.status === "Cancelled"
        ) {
          continue
        }
        await b2b.post(`/api/reservations/${reservation.id}/cancel`)
      }
    }
    await b2b.delete(`/api/assets/${location.assetId}`)
    await b2b.delete(`/api/assets/${location.assetId}`)
  }
}

export function formatBrazilClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SAO_PAULO_TZ,
  })
}

export async function openAgendaOnDate(
  page: Page,
  subdomain: string,
  date: string,
  locationName: string,
): Promise<void> {
  await page.goto(`/t/${subdomain}/agenda`)
  await expect(page).not.toHaveURL(/\/login/)
  const dateField = page.locator('input[type="date"]')
  await expect(dateField).toBeVisible({ timeout: 30_000 })
  await dateField.fill(date)
    await expect(page.getByRole("button", { name: new RegExp(escapeRegExp(locationName)) })).toBeVisible({
      timeout: 30_000,
    })
}

export async function selectLocationOnAgenda(
  page: Page,
  locationName: string,
  startTime: string,
): Promise<void> {
  const hhmm = startTime.slice(0, 5)
  const timeSelect = page.locator("select")
  await expect(timeSelect).toBeEnabled({ timeout: 30_000 })
  const option = timeSelect.locator("option").filter({ hasText: hhmm }).first()
  const value = await option.getAttribute("value")
  if (value) {
    await timeSelect.selectOption(value)
  } else {
    await timeSelect.selectOption({ label: new RegExp(hhmm) })
  }
  await page.getByRole("button", { name: new RegExp(escapeRegExp(locationName)) }).click()
}

