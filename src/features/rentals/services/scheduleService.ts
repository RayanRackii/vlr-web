import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const occupancyKindSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  colorHex: z.string().nullable().optional(),
  iconKey: z.string().nullable().optional(),
  isBookableByCustomer: z.boolean(),
  blocksCapacity: z.boolean(),
  sortOrder: z.number(),
  isActive: z.boolean(),
})

export type OccupancyKind = z.infer<typeof occupancyKindSchema>

const scheduleTemplateSchema = z.object({
  id: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  assetName: z.string(),
  dayOfWeek: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  occupancyKindId: z.string().uuid(),
  occupancyKindLabel: z.string(),
  label: z.string().nullable().optional(),
  isActive: z.boolean(),
})

export type ScheduleTemplate = z.infer<typeof scheduleTemplateSchema>

const scheduleSlotSchema = z.object({
  id: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  assetName: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  occupancyKindId: z.string().uuid(),
  occupancyKindKey: z.string(),
  occupancyKindLabel: z.string(),
  occupancyKindColorHex: z.string().nullable().optional(),
  isBookableByCustomer: z.boolean(),
  label: z.string().nullable().optional(),
  status: z.string(),
  reservationId: z.string().uuid().nullable().optional(),
  isDerived: z.boolean(),
  source: z.enum(["WeeklyDefault", "DailyOverride"]).default("WeeklyDefault"),
  sourceTemplateId: z.string().uuid().nullable().optional(),
  schedulePolicy: z.enum(["SlotGrid", "OpenHours"]).default("SlotGrid"),
  supportsEntireRecurrence: z.boolean().default(false),
})

const dayScheduleSchema = z.object({
  date: z.string(),
  slots: z.array(scheduleSlotSchema),
})

export type AdminDaySchedule = z.infer<typeof dayScheduleSchema>
export type AdminDaySlot = AdminDaySchedule["slots"][number]

export type DailyOccurrenceAction =
  | "Update"
  | "MakeUnavailable"
  | "RestoreWeeklyDefault"

export type OccurrenceEditScope = "OnlyThisDay" | "EntireRecurrence"

export const EMPTY_SLOT_ID = "00000000-0000-0000-0000-000000000000"

export function isPersistedSlotId(id: string | null | undefined): boolean {
  return Boolean(id && id !== EMPTY_SLOT_ID)
}

const rentalAssetSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  schedulePolicy: z.enum(["SlotGrid", "OpenHours"]).optional().default("SlotGrid"),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
  allowedDurationMinutes: z.string().nullable().optional(),
  unitId: z.string().uuid(),
})

export type AdminRentalAsset = z.infer<typeof rentalAssetSchema>

export type SchedulePolicy = "SlotGrid" | "OpenHours"

export type UpdateSchedulePolicyInput = {
  schedulePolicy: SchedulePolicy
  openTime?: string | null
  closeTime?: string | null
  allowedDurationMinutes?: string | null
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export type DayOfWeekName = (typeof DAY_NAMES)[number]

/** Normalize HTML time (`HH:MM`) or API time to `HH:MM:SS`. */
export function normalizeScheduleTime(value: string): string {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }
  return trimmed
}

export type UpsertOccupancyKindInput = {
  key: string
  label: string
  description?: string | null
  colorHex?: string | null
  iconKey?: string | null
  isBookableByCustomer: boolean
  blocksCapacity: boolean
  sortOrder: number
  isActive: boolean
}

export async function listOccupancyKinds(): Promise<OccupancyKind[]> {
  const response = await api.get("/api/occupancy-kinds")
  const parsed = z.array(occupancyKindSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function createOccupancyKind(
  body: UpsertOccupancyKindInput,
): Promise<OccupancyKind> {
  try {
    const response = await api.post("/api/occupancy-kinds", {
      ...body,
      description: body.description || null,
      colorHex: body.colorHex || null,
      iconKey: body.iconKey || null,
    })
    const parsed = occupancyKindSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.createOccupancyKind")),
    )
  }
}

export async function updateOccupancyKind(
  id: string,
  body: UpsertOccupancyKindInput,
): Promise<OccupancyKind> {
  try {
    const response = await api.put(`/api/occupancy-kinds/${id}`, {
      ...body,
      description: body.description || null,
      colorHex: body.colorHex || null,
      iconKey: body.iconKey || null,
    })
    const parsed = occupancyKindSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.updateOccupancyKind")),
    )
  }
}

function rentableQueryPath(
  path: string,
  rentalAssetId?: string,
  rentalAssetIds?: readonly string[],
): string {
  const params = new URLSearchParams()
  if (rentalAssetIds && rentalAssetIds.length > 0) {
    for (const id of rentalAssetIds) {
      params.append("rentalAssetIds", id)
    }
  } else if (rentalAssetId) {
    params.set("rentalAssetId", rentalAssetId)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export async function listScheduleTemplates(
  rentalAssetId?: string,
  rentalAssetIds?: readonly string[],
  dayOfWeek?: string,
): Promise<ScheduleTemplate[]> {
  const basePath = rentableQueryPath(
    "/api/schedule/templates",
    rentalAssetId,
    rentalAssetIds,
  )
  const path = dayOfWeek
    ? `${basePath}${basePath.includes("?") ? "&" : "?"}dayOfWeek=${dayOfWeek}`
    : basePath
  const response = await api.get(path)
  const parsed = z.array(scheduleTemplateSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function createScheduleTemplate(body: {
  rentalAssetId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  occupancyKindId: string
  label?: string | null
  isActive?: boolean
}): Promise<ScheduleTemplate> {
  try {
    const response = await api.post("/api/schedule/templates", {
      ...body,
      startTime: normalizeScheduleTime(body.startTime),
      endTime: normalizeScheduleTime(body.endTime),
      isActive: body.isActive ?? true,
    })
    const parsed = scheduleTemplateSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.createTemplate")),
    )
  }
}

export async function updateScheduleTemplate(
  id: string,
  body: {
    rentalAssetId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    occupancyKindId: string
    label?: string | null
    isActive?: boolean
  },
): Promise<ScheduleTemplate> {
  try {
    const response = await api.put(`/api/schedule/templates/${id}`, {
      ...body,
      startTime: normalizeScheduleTime(body.startTime),
      endTime: normalizeScheduleTime(body.endTime),
      isActive: body.isActive ?? true,
    })
    const parsed = scheduleTemplateSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.updateTemplate")),
    )
  }
}

export async function deleteScheduleTemplate(id: string): Promise<void> {
  try {
    await api.delete(`/api/schedule/templates/${id}`)
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.deleteTemplate")),
    )
  }
}

export async function publishScheduleDay(body: {
  date: string
  rentalAssetId?: string | null
  rentalAssetIds?: readonly string[]
}): Promise<number> {
  try {
    const response = await api.post("/api/schedule/days/publish", {
      date: body.date,
      rentalAssetId: body.rentalAssetId ?? null,
      rentalAssetIds: body.rentalAssetIds ?? null,
    })
    const created = z.object({ created: z.number() }).safeParse(response.data)
    if (!created.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return created.data.created
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.publishDay")),
    )
  }
}

export async function fetchAdminScheduleDay(
  date: string,
  rentalAssetIds?: readonly string[],
): Promise<AdminDaySchedule> {
  const response = await api.get(
    rentableQueryPath(`/api/schedule/days/${date}`, undefined, rentalAssetIds),
  )
  const parsed = dayScheduleSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function applyDailyOccurrence(body: {
  slotId?: string | null
  rentalAssetId: string
  date: string
  startTime: string
  endTime: string
  action: DailyOccurrenceAction
  scope?: OccurrenceEditScope
  occupancyKindId?: string | null
  label?: string | null
}): Promise<AdminDaySlot> {
  try {
    const response = await api.post("/api/schedule/slots/daily-occurrence", {
      slotId: isPersistedSlotId(body.slotId) ? body.slotId : null,
      rentalAssetId: body.rentalAssetId,
      date: body.date,
      startTime: normalizeScheduleTime(body.startTime),
      endTime: normalizeScheduleTime(body.endTime),
      action: body.action,
      scope: body.scope ?? "OnlyThisDay",
      occupancyKindId: body.occupancyKindId ?? null,
      label: body.label ?? null,
    })
    const parsed = scheduleSlotSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.applyDailyOccurrence"),
      ),
    )
  }
}

export async function applyWeeklyRule(body: {
  rentalAssetIds: readonly string[]
  daysOfWeek: readonly string[]
  openTime: string
  closeTime: string
  slotMinutes: number
  occupancyKindId: string
  label?: string | null
  isActive?: boolean
}): Promise<{ created: number; updated: number; skipped: number }> {
  try {
    const response = await api.post("/api/schedule/templates/apply-weekly-rule", {
      rentalAssetIds: body.rentalAssetIds,
      daysOfWeek: body.daysOfWeek,
      openTime: normalizeScheduleTime(body.openTime),
      closeTime: normalizeScheduleTime(body.closeTime),
      slotMinutes: body.slotMinutes,
      occupancyKindId: body.occupancyKindId,
      label: body.label ?? null,
      isActive: body.isActive ?? true,
    })
    const parsed = z
      .object({
        created: z.number(),
        updated: z.number(),
        skipped: z.number(),
      })
      .safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.applyWeeklyRule"),
      ),
    )
  }
}

export async function listAdminRentalAssets(): Promise<AdminRentalAsset[]> {
  const response = await api.get("/api/rental-assets")
  const parsed = z.array(rentalAssetSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function updateRentalSchedulePolicy(
  rentalAssetId: string,
  body: UpdateSchedulePolicyInput,
): Promise<AdminRentalAsset> {
  try {
    const response = await api.put(
      `/api/rental-assets/${rentalAssetId}/schedule-policy`,
      toSchedulePolicyBody(body),
    )
    const parsed = rentalAssetSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.updateSchedulePolicy"),
      ),
    )
  }
}

export async function updateRentalSchedulePolicyBulk(
  rentalAssetIds: readonly string[],
  body: UpdateSchedulePolicyInput,
): Promise<AdminRentalAsset[]> {
  try {
    const response = await api.put("/api/rental-assets/schedule-policy", {
      rentalAssetIds,
      ...toSchedulePolicyBody(body),
    })
    const parsed = z
      .object({
        updated: z.number(),
        items: z.array(rentalAssetSchema),
      })
      .safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data.items
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.updateSchedulePolicy"),
      ),
    )
  }
}

function toSchedulePolicyBody(body: UpdateSchedulePolicyInput) {
  return {
    schedulePolicy: body.schedulePolicy,
    openTime: body.openTime
      ? normalizeScheduleTime(body.openTime).slice(0, 8)
      : null,
    closeTime: body.closeTime
      ? normalizeScheduleTime(body.closeTime).slice(0, 8)
      : null,
    allowedDurationMinutes: body.allowedDurationMinutes ?? null,
  }
}

/**
 * Seeds Sun–Sat hourly Open templates (default 08:00–22:00) in one API call.
 */
export async function seedDefaultHourlyTemplates(
  rentalAssetIds: string | readonly string[],
  options?: {
    openTime?: string
    closeTime?: string
    slotMinutes?: number
  },
): Promise<number> {
  const ids = typeof rentalAssetIds === "string" ? [rentalAssetIds] : [...rentalAssetIds]
  try {
    const response = await api.post("/api/schedule/templates/seed-default", {
      rentalAssetId: ids.length === 1 ? ids[0] : undefined,
      rentalAssetIds: ids,
      openTime: options?.openTime
        ? normalizeScheduleTime(options.openTime).slice(0, 8)
        : "08:00:00",
      closeTime: options?.closeTime
        ? normalizeScheduleTime(options.closeTime).slice(0, 8)
        : "22:00:00",
      slotMinutes: options?.slotMinutes ?? 60,
    })
    const parsed = z
      .object({ created: z.number(), skipped: z.number() })
      .safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidResponse"))
    }
    return parsed.data.created
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.seedTemplates")),
    )
  }
}

export function formatScheduleTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}
