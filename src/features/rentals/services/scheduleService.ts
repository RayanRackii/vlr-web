import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const occupancyKindSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  label: z.string(),
  colorHex: z.string().nullable().optional(),
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
})

const dayScheduleSchema = z.object({
  date: z.string(),
  slots: z.array(scheduleSlotSchema),
})

export type AdminDaySchedule = z.infer<typeof dayScheduleSchema>

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
  colorHex?: string | null
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
      colorHex: body.colorHex || null,
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
      colorHex: body.colorHex || null,
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

export async function listScheduleTemplates(
  rentalAssetId?: string,
): Promise<ScheduleTemplate[]> {
  const response = await api.get("/api/schedule/templates", {
    params: rentalAssetId ? { rentalAssetId } : undefined,
  })
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
}): Promise<number> {
  try {
    const response = await api.post("/api/schedule/days/publish", {
      date: body.date,
      rentalAssetId: body.rentalAssetId ?? null,
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
  rentalAssetId?: string,
): Promise<AdminDaySchedule> {
  const response = await api.get(`/api/schedule/days/${date}`, {
    params: rentalAssetId ? { rentalAssetId } : undefined,
  })
  const parsed = dayScheduleSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
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
      {
        schedulePolicy: body.schedulePolicy,
        openTime: body.openTime
          ? normalizeScheduleTime(body.openTime).slice(0, 8)
          : null,
        closeTime: body.closeTime
          ? normalizeScheduleTime(body.closeTime).slice(0, 8)
          : null,
        allowedDurationMinutes: body.allowedDurationMinutes ?? null,
      },
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

/**
 * Seeds Sun–Sat hourly Open templates (default 08:00–22:00) in one API call.
 */
export async function seedDefaultHourlyTemplates(
  rentalAssetId: string,
  options?: {
    openTime?: string
    closeTime?: string
    slotMinutes?: number
  },
): Promise<number> {
  try {
    const response = await api.post("/api/schedule/templates/seed-default", {
      rentalAssetId,
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
