import { z } from "zod"

import {
  taskInputTypeResponseSchema,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"

export const globalTemplateStatusValues = ["Published", "Deprecated"] as const

export const globalTemplateStatusSchema = z.enum(globalTemplateStatusValues)

export type GlobalTemplateStatus = z.infer<typeof globalTemplateStatusSchema>

const globalTemplateStatusByIndex = [
  "Published",
  "Deprecated",
] as const satisfies readonly GlobalTemplateStatus[]

export const globalTemplateStatusResponseSchema = z.union([
  globalTemplateStatusSchema,
  z
    .number()
    .int()
    .refine((value): value is 0 | 1 => value === 0 || value === 1)
    .transform((value) => globalTemplateStatusByIndex[value]),
])

export const globalTemplateTaskSchema = z.object({
  id: z.string().uuid(),
  globalMaintenanceTemplateId: z.string().uuid(),
  title: z.string().min(1),
  inputType: taskInputTypeResponseSchema,
  configuration: z.string().nullish(),
  isMandatory: z.boolean(),
  order: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type GlobalTemplateTask = z.infer<typeof globalTemplateTaskSchema>

export const globalMaintenanceTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  jurisdiction: z.string().min(1),
  targetEquipmentType: z.string().min(1),
  libraryKey: z.string().min(1).max(80),
  version: z.number().int(),
  status: globalTemplateStatusResponseSchema,
  sourceReferences: z.string().nullable(),
  tasks: z.array(globalTemplateTaskSchema),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type GlobalMaintenanceTemplate = z.infer<
  typeof globalMaintenanceTemplateSchema
>

export const globalMaintenanceTemplateListSchema = z.array(
  globalMaintenanceTemplateSchema,
)
