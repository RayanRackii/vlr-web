import { z } from "zod"

/** Lifecycle of an allocation, as the API names it. */
export const allocationStatuses = ["Scheduled", "Running", "Cleaning", "Released", "Cancelled"] as const
export type AllocationStatus = (typeof allocationStatuses)[number]

export const allocationKinds = ["Use", "Unavailable"] as const
export type AllocationKind = (typeof allocationKinds)[number]

export const hoursPolicies = ["Anytime", "StartWithinHours", "WithinHours"] as const
export type HoursPolicy = (typeof hoursPolicies)[number]

export const usageActions = ["start", "work-finished", "release", "cancel"] as const
export type UsageAction = (typeof usageActions)[number]

const text = z.string().nullish().transform((value) => value ?? "")
const nullableText = z.string().nullish().transform((value) => value ?? null)

export const workingWindowSchema = z.object({
  dayOfWeek: z.number().int(),
  openTime: text,
  closeTime: text,
})
export type WorkingWindow = z.infer<typeof workingWindowSchema>

export const planningAssetSchema = z.object({
  id: z.string(),
  name: text,
  tag: text,
  categoryName: text,
  unitId: text,
  unitName: text,
  status: text,
  isPlannable: z.boolean().default(false),
  isRentalBacked: z.boolean().default(false),
  hoursPolicy: text,
  workingWindowCount: z.number().int().default(0),
})
export type PlanningAsset = z.infer<typeof planningAssetSchema>

export const allocationSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  assetName: text,
  unitId: text,
  kind: text,
  title: text,
  notes: text,
  quantity: z.number().int().default(1),
  plannedWorkStart: z.string(),
  plannedWorkEnd: z.string(),
  occupiedStart: z.string(),
  occupiedEnd: z.string(),
  timeZoneId: text,
  status: text,
  source: text,
  referenceLabel: text,
  createdByUserId: nullableText,
  cancelReason: text,
  actualStartAt: nullableText,
  actualWorkFinishedAt: nullableText,
  actualReleaseAt: nullableText,
  isBlocking: z.boolean().default(false),
  isExpired: z.boolean().default(false),
  isOverdue: z.boolean().default(false),
  /** Base64 rowVersion; sent back as `expectedVersion`. */
  version: text,
})
export type PlanningAllocation = z.infer<typeof allocationSchema>

export const agendaResourceSchema = z.object({
  assetId: z.string(),
  name: text,
  tag: text,
  unitId: text,
  unitName: text,
  capacity: z.number().int().default(1),
  hoursPolicy: text,
  isRentalBacked: z.boolean().default(false),
  timeZoneId: text,
  workingHours: z.array(workingWindowSchema).nullish().transform((value) => value ?? []),
})
export type PlanningAgendaResource = z.infer<typeof agendaResourceSchema>

export const externalBusySchema = z.object({ assetId: z.string(), start: z.string(), end: z.string() })
export type PlanningExternalBusy = z.infer<typeof externalBusySchema>

export const planningAgendaSchema = z.object({
  from: z.string(),
  to: z.string(),
  resources: z.array(agendaResourceSchema).nullish().transform((value) => value ?? []),
  items: z.array(allocationSchema).nullish().transform((value) => value ?? []),
  externalBusy: z.array(externalBusySchema).nullish().transform((value) => value ?? []),
})
export type PlanningAgenda = z.infer<typeof planningAgendaSchema>

export const conflictSchema = z.object({
  source: text,
  allocationId: nullableText,
  start: z.string(),
  end: z.string(),
  label: text,
})
export type PlanningConflict = z.infer<typeof conflictSchema>

export const previewSchema = z.object({
  feasible: z.boolean(),
  occupiedStart: nullableText,
  occupiedEnd: nullableText,
  conflicts: z.array(conflictSchema).nullish().transform((value) => value ?? []),
  hoursViolation: nullableText,
})
export type AllocationPreview = z.infer<typeof previewSchema>

export const allocationListSchema = z.array(allocationSchema)
export const planningAssetListSchema = z.array(planningAssetSchema)

export type CreateAllocationRequest = {
  assetId: string
  kind: AllocationKind
  title: string
  notes?: string | null
  workStart: string
  workEnd: string
  prepMinutes?: number | null
  cleanupMinutes?: number | null
}

export type UpdateAllocationRequest = {
  expectedVersion: string
  title?: string
  notes?: string | null
  workStart?: string
  workEnd?: string
  prepMinutes?: number | null
  cleanupMinutes?: number | null
}

export type UsageRequest = { action: UsageAction; expectedVersion: string; reason?: string | null }

/** An asset's planning profile as `GET /api/planning/assets/{id}/profile` returns it. */
export const assetProfileSchema = z.object({
  assetId: z.string(),
  isConfigured: z.boolean().default(false),
  isPlannable: z.boolean().default(false),
  isRentalBacked: z.boolean().default(false),
  capacity: z.number().int().default(1),
  hoursPolicy: z.string().nullish().transform((value) => value ?? ""),
  defaultPrepMinutes: z.number().int().default(0),
  defaultCleanupMinutes: z.number().int().default(0),
  workingHours: z.array(workingWindowSchema).nullish().transform((value) => value ?? []),
})
export type AssetProfile = z.infer<typeof assetProfileSchema>

/** Body of `PUT /api/planning/assets/{id}/profile`. Times are "HH:mm"; day 0 is Sunday. */
export type PutAssetProfileRequest = {
  isPlannable: boolean
  capacity: number
  hoursPolicy: HoursPolicy
  defaultPrepMinutes: number
  defaultCleanupMinutes: number
  workingHours: { dayOfWeek: number; openTime: string; closeTime: string }[]
}
