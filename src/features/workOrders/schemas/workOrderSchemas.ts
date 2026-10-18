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

/** Wave 2 picker: GET /api/work-orders/assets (`RegistryAssetListItem`). */
export const workOrderRegistryAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  tag: z.string().min(1),
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  status: assetStatusResponseSchema,
  scheduledDeletionAt: z.string().nullish(),
})

export type WorkOrderRegistryAsset = z.infer<typeof workOrderRegistryAssetSchema>

export const workOrderRegistryAssetListSchema = z.array(
  workOrderRegistryAssetSchema,
)

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
  sourcePlanName: z.string().nullish(),
  assignedUserId: z.string().uuid().nullish(),
  status: workOrderStatusResponseSchema,
  scheduledDate: z.string().min(1),
  completedDate: z.string().nullish(),
  notes: z.string().nullish(),
  asset: workOrderAssetSchema,
  assignedUser: z
    .object({
      id: z.string().uuid(),
      fullName: z.string(),
      email: z.string(),
    })
    .nullish(),
  tasks: z.array(workOrderTaskSchema),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type WorkOrder = z.infer<typeof workOrderSchema>

export const workOrderListSchema = z.array(workOrderSchema)

export const createWorkOrderTaskRequestSchema = z.object({
  planTaskId: z.string().uuid().nullish(),
  title: z.string().trim().min(1),
  inputType: taskInputTypeSchema,
  isMandatory: z.boolean(),
  order: z.number().int().nonnegative(),
  configuration: z.string().nullish(),
})

export const createWorkOrderRequestSchema = z.object({
  assetId: z.string().uuid(),
  maintenancePlanId: z.string().uuid().nullish(),
  assignedUserId: z.string().uuid().nullish(),
  scheduledDate: z.string().min(1),
  notes: z.string().trim().nullish(),
  tasks: z.array(createWorkOrderTaskRequestSchema).min(1),
})

export type CreateWorkOrderRequest = z.infer<
  typeof createWorkOrderRequestSchema
>

export const generateWorkOrderFromPlanRequestSchema = z.object({
  planId: z.string().uuid(),
  assetId: z.string().uuid(),
  assignedUserId: z.string().uuid().nullish(),
  scheduledDate: z.string().min(1),
})

export type GenerateWorkOrderFromPlanRequest = z.infer<
  typeof generateWorkOrderFromPlanRequestSchema
>

type GenerateWorkOrderFromPlanFormMessages = {
  assetRequired: string
  dateRequired: string
}

export function generateWorkOrderFromPlanFormSchema(
  messages: GenerateWorkOrderFromPlanFormMessages,
) {
  return z.object({
    assetId: z.string().uuid(messages.assetRequired),
    assignedUserId: z.string().uuid().optional(),
    scheduledDate: z.string().min(1, messages.dateRequired),
  })
}

export type GenerateWorkOrderFromPlanFormValues = z.infer<
  ReturnType<typeof generateWorkOrderFromPlanFormSchema>
>

type CreateWorkOrderFormMessages = {
  assetRequired: string
  dateRequired: string
  taskRequired: string
}

export function createWorkOrderFormSchema(
  messages: CreateWorkOrderFormMessages,
) {
  return z.object({
    assetId: z.string().uuid(messages.assetRequired),
    assignedUserId: z.string().uuid().optional(),
    scheduledDate: z.string().min(1, messages.dateRequired),
    notes: z.string(),
    taskTitle: z.string().trim().min(1, messages.taskRequired),
  })
}

export type CreateWorkOrderFormValues = z.infer<
  ReturnType<typeof createWorkOrderFormSchema>
>

export const workOrderTaskFileSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    value: z.string().uuid(),
  })
  .refine((file) => file.id === file.value, { path: ["value"] })

export type WorkOrderTaskFile = z.infer<typeof workOrderTaskFileSchema>

export const workOrderTaskFileUrlSchema = z.object({
  url: z.string().url(),
  isPublic: z.literal(false),
})

export type WorkOrderTaskFileUrl = z.infer<typeof workOrderTaskFileUrlSchema>

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

function readChoiceLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const labels: string[] = []
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim()
      if (trimmed.length > 0) {
        labels.push(trimmed)
      }
      continue
    }

    if (typeof item === "object" && item !== null) {
      const record = item as Record<string, unknown>
      const label =
        typeof record.label === "string"
          ? record.label
          : typeof record.value === "string"
            ? record.value
            : null
      const trimmed = label?.trim() ?? ""
      if (trimmed.length > 0) {
        labels.push(trimmed)
      }
    }
  }

  return labels
}

export function parseSingleChoiceConfiguration(
  configuration: string | null | undefined,
): SingleChoiceTaskConfiguration | null {
  if (!configuration) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(configuration)
  } catch {
    return null
  }

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }

  const direct = singleChoiceTaskConfigurationSchema.safeParse(parsed)
  if (direct.success && direct.data.options.length > 0) {
    return {
      options: direct.data.options
        .map((option) => option.trim())
        .filter((option) => option.length > 0),
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null
  }

  const record = parsed as Record<string, unknown>
  const options = readChoiceLabels(record.options ?? record.choices)
  return options.length > 0 ? { options } : null
}

export type { TaskInputType }
export { taskInputTypeSchema }
