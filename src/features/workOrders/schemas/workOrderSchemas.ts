import { z } from "zod"

import {
  taskInputTypeResponseSchema,
  taskInputTypeSchema,
  type TaskInputType,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { assetStatusResponseSchema } from "@/features/assets/schemas/assetSchemas"

export const workOrderStatusValues = [
  "Pending",
  "InProgress",
  "Completed",
  "Canceled",
] as const

export const workOrderStatusSchema = z.enum(workOrderStatusValues)

export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>

const workOrderStatusByIndex = [
  "Pending",
  "InProgress",
  "Completed",
  "Canceled",
] as const satisfies readonly WorkOrderStatus[]

export const workOrderStatusResponseSchema = z.union([
  workOrderStatusSchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 | 2 | 3 =>
        value >= 0 && value < workOrderStatusByIndex.length,
    )
    .transform((value) => workOrderStatusByIndex[value]),
])

export const workOrderAssetSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  tag: z.string().min(1),
  location: z.string().nullish(),
  status: assetStatusResponseSchema,
})

export type WorkOrderAsset = z.infer<typeof workOrderAssetSchema>

export const workOrderTaskSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  workOrderId: z.string().uuid(),
  planTaskId: z.string().uuid().nullish(),
  title: z.string().min(1),
  inputType: taskInputTypeResponseSchema,
  configuration: z.string().nullish(),
  isMandatory: z.boolean(),
  order: z.number().int(),
  value: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type WorkOrderTask = z.infer<typeof workOrderTaskSchema>

export const workOrderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  assetId: z.string().uuid(),
  maintenancePlanId: z.string().uuid().nullish(),
  status: workOrderStatusResponseSchema,
  scheduledDate: z.string().min(1),
  completedDate: z.string().nullish(),
  notes: z.string().nullish(),
  asset: workOrderAssetSchema,
  tasks: z.array(workOrderTaskSchema),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type WorkOrder = z.infer<typeof workOrderSchema>

export const workOrderListSchema = z.array(workOrderSchema)

export const updateWorkOrderTaskValueRequestSchema = z.object({
  value: z.string().nullish(),
})

export type UpdateWorkOrderTaskValueRequest = z.infer<
  typeof updateWorkOrderTaskValueRequestSchema
>

export const updateWorkOrderStatusRequestSchema = z.object({
  status: workOrderStatusSchema,
})

export type UpdateWorkOrderStatusRequest = z.infer<
  typeof updateWorkOrderStatusRequestSchema
>

export const numberTaskConfigurationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
})

export type NumberTaskConfiguration = z.infer<
  typeof numberTaskConfigurationSchema
>

export const singleChoiceTaskConfigurationSchema = z.object({
  options: z.array(z.string()),
})

export type SingleChoiceTaskConfiguration = z.infer<
  typeof singleChoiceTaskConfigurationSchema
>

export function parseNumberConfiguration(
  configuration: string | null | undefined,
): NumberTaskConfiguration | null {
  if (!configuration) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(configuration)
    const result = numberTaskConfigurationSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function parseSingleChoiceConfiguration(
  configuration: string | null | undefined,
): SingleChoiceTaskConfiguration | null {
  if (!configuration) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(configuration)
    const result = singleChoiceTaskConfigurationSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export type { TaskInputType }
export { taskInputTypeSchema }
