import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import { mapRbacErrorMessage } from "@/features/users/permissions/rbacErrors"
import i18n from "@/lib/i18n"
import { guidLikeIdSchema } from "@/features/assets/schemas/assetFamilySchemas"

/** Prefers the ASP.NET ProblemDetails `detail`/`errors` fields over the generic `{ error }` shape. */
function parseProblemDetailsError(error: unknown, fallback: string): string {
  const payload = getAxiosErrorPayload(error)
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>
    if (typeof record.detail === "string" && record.detail.trim() !== "") {
      return record.detail
    }
    if (typeof record.errors === "object" && record.errors !== null) {
      const messages = Object.values(record.errors as Record<string, unknown>)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      if (messages.length > 0) {
        return messages.join(" ")
      }
    }
  }
  return parseApiError(payload, fallback)
}

function lessonChangeError(error: unknown): Error {
  const fallback = i18n.t("rentals.teacherLessons.changeError")
  return new Error(
    mapRbacErrorMessage(parseApiError(getAxiosErrorPayload(error), fallback), fallback),
    { cause: error },
  )
}

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
  /** Staff day view only: reservation item quantity on this resource. */
  quantity: z.number().int().nullable().optional(),
  customerName: z.string().nullable().optional(),
  /** Set when this cell exists because a catalog order reserved the resource for internal use. */
  isInternalUseOrigin: z.boolean().optional(),
  /** Catalog order behind an internal-use cell; null when the viewer lacks catalog.orders.read. */
  owningCatalogOrderId: z.string().uuid().nullable().optional(),
  /** Internal-use cells only: work window ("HH:mm:ss" local). [slot start, workStart) = prep, [workEnd, slot end) = cleanup. */
  workStartTime: z.string().nullable().optional(),
  workEndTime: z.string().nullable().optional(),
})

const dayScheduleSchema = z.object({
  date: z.string(),
  slots: z.array(scheduleSlotSchema),
})

export type AdminDaySchedule = z.infer<typeof dayScheduleSchema>
export type AdminDaySlot = AdminDaySchedule["slots"][number]

export type TeacherLessonRequest = {
  rentalAssetId: string
  date: string
  startTime: string
  endTime: string
  label?: string | null
}

export async function createTeacherLesson(
  body: TeacherLessonRequest,
): Promise<AdminDaySlot> {
  try {
    const response = await api.post("/api/schedule/lessons", {
      ...body,
      startTime: normalizeScheduleTime(body.startTime),
      endTime: normalizeScheduleTime(body.endTime),
    })
    const parsed = scheduleSlotSchema.safeParse(response.data)
    if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidPayload"))
    return parsed.data
  } catch (error) {
    throw lessonChangeError(error)
  }
}

export async function removeTeacherLesson(
  body: Omit<TeacherLessonRequest, "label">,
): Promise<AdminDaySlot> {
  try {
    const response = await api.post("/api/schedule/lessons/remove", {
      ...body,
      startTime: normalizeScheduleTime(body.startTime),
      endTime: normalizeScheduleTime(body.endTime),
    })
    const parsed = scheduleSlotSchema.safeParse(response.data)
    if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidPayload"))
    return parsed.data
  } catch (error) {
    throw lessonChangeError(error)
  }
}

export type DailyOccurrenceAction =
  | "Update"
  | "MakeUnavailable"
  | "RestoreWeeklyDefault"

export type OccurrenceEditScope = "OnlyThisDay" | "EntireRecurrence"

export const EMPTY_SLOT_ID = "00000000-0000-0000-0000-000000000000"

export function isPersistedSlotId(id: string | null | undefined): boolean {
  return Boolean(id && id !== EMPTY_SLOT_ID)
}

export async function setDirectRental(rentalAssetId: string, directRental: boolean) {
  try {
    const response = await api.put<unknown>(`/api/rental-assets/${rentalAssetId}/direct-rental`, { directRental })
    const parsed = rentalAssetSchema.safeParse(response.data)
    if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidResponse"))
    return parsed.data
  } catch (error) {
    throw new Error(parseApiError(getAxiosErrorPayload(error), i18n.t("rentals.resources.errors.save")), { cause: error })
  }
}

export const rentalAssetSchema = z.object({
  tag: z.string().nullable().optional(),
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  requiresDeposit: z.boolean().optional().default(true),
  schedulePolicy: z.enum(["SlotGrid", "OpenHours"]).optional().default("SlotGrid"),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
  allowedDurationMinutes: z.string().nullable().optional(),
  unitId: z.string().uuid(),
  type: z.enum(["Location", "Good"]).optional().default("Location"),
  totalQuantity: z.number().int().optional().default(1),
  queueEnabled: z.boolean().optional().default(false),
  queueOpeningTime: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  /** Set when the underlying asset is scheduled for deletion (soft delete). */
  scheduledDeletionAt: z.string().nullable().optional(),
  familyId: guidLikeIdSchema.nullable().optional(),
  cancelCutoffHours: z.number().int().min(0).max(8760).nullable().optional(),
  effectiveCancelCutoffHours: z.number().int().min(0).max(8760).nullable().optional(),
  /** Stored override. Null inherits category, then tenant. Absent means the API did not send it. */
  minimumBookingLeadMinutes: z.number().int().min(0).max(525600).nullable().optional(),
  effectiveMinimumBookingLeadMinutes: z.number().int().min(0).max(525600).nullable().optional(),
  /** Stored override. Null inherits. This percent is not applied to a charge. */
  depositPercent: z.number().int().min(0).max(100).nullable().optional(),
  effectiveDepositPercent: z.number().int().min(0).max(100).nullable().optional(),
  directRental: z.boolean().optional(),
  /** Stored override. Null inherits the tenant policy. Absent means not sent. */
  maxAdvanceBookingDays: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .nullable()
    .optional(),
  /** Override, otherwise the tenant policy. Null means unlimited. */
  effectiveMaxAdvanceBookingDays: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .nullable()
    .optional(),
  visualTemplateRevisionId: guidLikeIdSchema.nullable().optional(),
  capacityPeople: z.number().int().nullable().optional(),
  /** Asset location. The drawer hydrates it so an edit does not clear it. */
  location: z.string().nullable().optional(),
  // Older API responses named this field `capacity`. Normalize it at the
  // boundary so edit defaults do not silently lose an existing capacity.
  capacity: z.number().int().nullable().optional(),
}).transform(({ capacity, capacityPeople, ...asset }) => ({
  ...asset,
  capacityPeople: capacityPeople ?? capacity,
}))

export type AdminRentalAsset = Omit<z.infer<typeof rentalAssetSchema>, "capacityPeople"> & {
  capacityPeople?: number | null
}

export type SchedulePolicy = "SlotGrid" | "OpenHours"

export type UpdateSchedulePolicyInput = {
  schedulePolicy: SchedulePolicy
  openTime?: string | null
  closeTime?: string | null
  allowedDurationMinutes?: string | null
  /** Undefined omits the field and keeps the stored override. Null clears it. */
  minimumBookingLeadMinutes?: number | null
  /** Undefined omits the field and keeps the stored override. Null clears it. */
  depositPercent?: number | null
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
    {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    },
  )
  const parsed = dayScheduleSchema.safeParse(response.data)
  if (parsed.success) return parsed.data
  const envelope = z.object({
    date: z.string(),
    slots: z.array(z.unknown()),
  }).safeParse(response.data)
  if (!envelope.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  const slots = envelope.data.slots.flatMap((slot) => {
    const one = scheduleSlotSchema.safeParse(slot)
    return one.success ? [one.data] : []
  })
  if (envelope.data.slots.length > 0 && slots.length === 0) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return { date: envelope.data.date, slots }
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
      parseProblemDetailsError(error, i18n.t("apiErrors.updateSchedulePolicy")),
    )
  }
}

function toSchedulePolicyBody(body: UpdateSchedulePolicyInput) {
  const payload: {
    schedulePolicy: SchedulePolicy
    openTime: string | null
    closeTime: string | null
    allowedDurationMinutes: string | null
    minimumBookingLeadMinutes?: number | null
    depositPercent?: number | null
  } = {
    schedulePolicy: body.schedulePolicy,
    openTime: body.openTime
      ? normalizeScheduleTime(body.openTime).slice(0, 8)
      : null,
    closeTime: body.closeTime
      ? normalizeScheduleTime(body.closeTime).slice(0, 8)
      : null,
    allowedDurationMinutes: body.allowedDurationMinutes ?? null,
  }
  if (body.minimumBookingLeadMinutes !== undefined) {
    payload.minimumBookingLeadMinutes = body.minimumBookingLeadMinutes
  }
  if (body.depositPercent !== undefined) {
    payload.depositPercent = body.depositPercent
  }
  return payload
}

export function groupAssetsByHours(
  assets: readonly { id: string; openTime?: string | null; closeTime?: string | null }[],
): { openTime: string; closeTime: string; ids: string[] }[] | null {
  const groups = new Map<string, { openTime: string; closeTime: string; ids: string[] }>()
  for (const asset of assets) {
    if (!asset.openTime || !asset.closeTime) return null
    const key = `${asset.openTime}\n${asset.closeTime}`
    const group = groups.get(key) ?? { openTime: asset.openTime, closeTime: asset.closeTime, ids: [] }
    group.ids.push(asset.id)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/**
 * Seeds hourly Open templates for an explicit interval. Callers must choose the hours.
 */
export async function seedDefaultHourlyTemplates(
  rentalAssetIds: string | readonly string[],
  options: {
    openTime: string
    closeTime: string
    slotMinutes?: number
  },
): Promise<number> {
  const ids = typeof rentalAssetIds === "string" ? [rentalAssetIds] : [...rentalAssetIds]
  try {
    const response = await api.post("/api/schedule/templates/seed-default", {
      rentalAssetId: ids.length === 1 ? ids[0] : undefined,
      rentalAssetIds: ids,
      openTime: normalizeScheduleTime(options.openTime).slice(0, 8),
      closeTime: normalizeScheduleTime(options.closeTime).slice(0, 8),
      slotMinutes: options.slotMinutes ?? 60,
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

/**
 * Rounds an "HH:mm", "HH:mm:ss", or "HH:mm:ss.fffffff" clock value to the
 * nearest minute and returns it as "HH:mm". A schedule end time can arrive with
 * fractional seconds after an early release (e.g. "06:38:26.4433560"); flooring
 * would misreport the end and raw seconds would leak into minute math. Falls
 * back to the leading "HH:mm" when the value is malformed so callers never get
 * NaN or a fractional width.
 */
export function roundScheduleTimeToMinute(value: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(value.trim())
  if (!match) {
    return value.length >= 5 ? value.slice(0, 5) : value
  }
  const seconds = match[3] ? Number(match[3]) : 0
  const minuteOfDay = Number(match[1]) * 60 + Number(match[2]) + Math.round(seconds / 60)
  // Preserve end-of-day "24:00" (and any rounding that reaches it, e.g.
  // "23:59:40") instead of clamping back into the previous minute.
  const total = Math.min(Math.max(minuteOfDay, 0), 24 * 60)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function formatScheduleTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}
