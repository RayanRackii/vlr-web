import { z } from "zod"

/** Modules whose data can be purged after they are turned off (mirrors the API allow-list). */
export const PURGEABLE_MODULE_KEYS = [
  "rentals",
  "catalog",
  "os",
  "pmoc",
  "resource-planning",
] as const

export function isPurgeableModuleKey(moduleKey: string): boolean {
  return (PURGEABLE_MODULE_KEYS as readonly string[]).includes(moduleKey)
}

const blockerSchema = z.object({
  code: z.string(),
  table: z.string().nullish(),
  rows: z.coerce.number().nullish(),
})

const pendingSchema = z.object({
  id: z.string(),
  scheduledFor: z.string(),
})

/** Tolerant reader: unknown fields are ignored and optional ones may be missing. */
export const moduleDataPurgePreviewSchema = z.object({
  module: z.string().optional(),
  moduleActive: z.boolean().optional().default(false),
  tables: z
    .array(z.object({ table: z.string(), rows: z.coerce.number() }))
    .default([]),
  storageObjects: z.coerce.number().default(0),
  blockers: z.array(blockerSchema).default([]),
  pending: pendingSchema.nullish(),
})

export type ModuleDataPurgePreview = z.infer<typeof moduleDataPurgePreviewSchema>
export type ModuleDataPurgeBlocker = z.infer<typeof blockerSchema>

export const moduleDataPurgeScheduledSchema = z.object({
  id: z.string(),
  scheduledFor: z.string(),
})

export type ModuleDataPurgeScheduled = z.infer<typeof moduleDataPurgeScheduledSchema>
