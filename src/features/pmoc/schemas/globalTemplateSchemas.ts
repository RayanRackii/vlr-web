import { z } from "zod"

import {
  maintenanceFrequencyResponseSchema,
  taskInputTypeResponseSchema,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"

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
  frequency: maintenanceFrequencyResponseSchema,
  jurisdiction: z.string().min(1),
  targetEquipmentType: z.string().min(1),
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
