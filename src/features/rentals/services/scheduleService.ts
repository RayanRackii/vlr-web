import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"

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
  schedulePolicy: z.string().optional(),
  unitId: z.string().uuid(),
})

export type AdminRentalAsset = z.infer<typeof rentalAssetSchema>

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

function padTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00:00`
}

export async function listOccupancyKinds(): Promise<OccupancyKind[]> {
  const response = await api.get("/api/occupancy-kinds")
  const parsed = z.array(occupancyKindSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid occupancy kinds payload.")
  }
  return parsed.data
}

export async function listScheduleTemplates(
  rentalAssetId?: string,
): Promise<ScheduleTemplate[]> {
  const response = await api.get("/api/schedule/templates", {
    params: rentalAssetId ? { rentalAssetId } : undefined,
  })
  const parsed = z.array(scheduleTemplateSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid schedule templates payload.")
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
      isActive: body.isActive ?? true,
    })
    const parsed = scheduleTemplateSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid create template response.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not create template."),
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
      throw new Error("Invalid publish response.")
    }
    return created.data.created
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not publish day."),
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
    throw new Error("Invalid schedule day payload.")
  }
  return parsed.data
}

export async function listAdminRentalAssets(): Promise<AdminRentalAsset[]> {
  const response = await api.get("/api/rental-assets")
  const parsed = z.array(rentalAssetSchema).safeParse(response.data)
  if (!parsed.success) {
    throw new Error("Invalid rental assets payload.")
  }
  return parsed.data
}

/**
 * Seeds Mon–Sun hourly Open templates (08:00–22:00) when missing for the rentable.
 */
export async function seedDefaultHourlyTemplates(
  rentalAssetId: string,
): Promise<number> {
  const [kinds, existing] = await Promise.all([
    listOccupancyKinds(),
    listScheduleTemplates(rentalAssetId),
  ])

  const openKind =
    kinds.find(
      (kind) =>
        kind.key.toLowerCase() === "open" &&
        kind.isActive &&
        kind.isBookableByCustomer,
    ) ?? kinds.find((kind) => kind.isBookableByCustomer && kind.isActive)

  if (!openKind) {
    throw new Error("No bookable occupancy kind found. Create an Open kind first.")
  }

  const existingKeys = new Set(
    existing.map(
      (row) =>
        `${row.dayOfWeek}|${row.startTime.slice(0, 5)}|${row.endTime.slice(0, 5)}`,
    ),
  )

  let created = 0
  for (const dayOfWeek of DAY_NAMES) {
    for (let hour = 8; hour < 22; hour += 1) {
      const startTime = padTime(hour)
      const endTime = padTime(hour + 1)
      const key = `${dayOfWeek}|${startTime.slice(0, 5)}|${endTime.slice(0, 5)}`
      if (existingKeys.has(key)) {
        continue
      }
      await createScheduleTemplate({
        rentalAssetId,
        dayOfWeek,
        startTime,
        endTime,
        occupancyKindId: openKind.id,
      })
      created += 1
    }
  }

  return created
}

export function formatScheduleTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}
