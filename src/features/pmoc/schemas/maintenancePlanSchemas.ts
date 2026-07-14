import { z } from "zod"

export const maintenanceFrequencyValues = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Semiannual",
  "Annual",
] as const

export const maintenanceFrequencySchema = z.enum(maintenanceFrequencyValues)

export type MaintenanceFrequency = z.infer<typeof maintenanceFrequencySchema>

const maintenanceFrequencyByIndex = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Semiannual",
  "Annual",
] as const satisfies readonly MaintenanceFrequency[]

/** ASP.NET may serialize enums as numbers unless JsonStringEnumConverter is enabled. */
export const maintenanceFrequencyResponseSchema = z.union([
  maintenanceFrequencySchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 | 2 | 3 | 4 | 5 =>
        value >= 0 && value < maintenanceFrequencyByIndex.length,
    )
    .transform((value) => maintenanceFrequencyByIndex[value]),
])

export const taskInputTypeValues = [
  "Checkbox",
  "Text",
  "Number",
  "Image",
  "SingleChoice",
] as const

export const taskInputTypeSchema = z.enum(taskInputTypeValues)

export type TaskInputType = z.infer<typeof taskInputTypeSchema>

const taskInputTypeByIndex = [
  "Checkbox",
  "Text",
  "Number",
  "Image",
  "SingleChoice",
] as const satisfies readonly TaskInputType[]

export const taskInputTypeResponseSchema = z.union([
  taskInputTypeSchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 | 2 | 3 | 4 =>
        value >= 0 && value < taskInputTypeByIndex.length,
    )
    .transform((value) => taskInputTypeByIndex[value]),
])

export const planTaskSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  maintenancePlanId: z.string().uuid(),
  title: z.string().min(1),
  inputType: taskInputTypeResponseSchema,
  isMandatory: z.boolean(),
  order: z.number().int(),
  configuration: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type PlanTask = z.infer<typeof planTaskSchema>

export const maintenancePlanSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  frequency: maintenanceFrequencyResponseSchema,
  assetCategoryId: z.string().uuid(),
  isActive: z.boolean(),
  tasks: z.array(planTaskSchema),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type MaintenancePlan = z.infer<typeof maintenancePlanSchema>

export const maintenancePlanListSchema = z.array(maintenancePlanSchema)

export const createPlanTaskRequestSchema = z.object({
  title: z.string().trim().min(1),
  inputType: taskInputTypeSchema,
  isMandatory: z.boolean(),
  order: z.number().int(),
  configuration: z.string().nullish(),
})

export type CreatePlanTaskRequest = z.infer<typeof createPlanTaskRequestSchema>

export const createMaintenancePlanRequestSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().nullish(),
  frequency: maintenanceFrequencySchema,
  assetCategoryId: z.string().uuid(),
  isActive: z.boolean(),
  tasks: z.array(createPlanTaskRequestSchema).min(1),
})

export type CreateMaintenancePlanRequest = z.infer<
  typeof createMaintenancePlanRequestSchema
>

export function createPlanFormSchema(messages: {
  unitRequired: string
  nameRequired: string
  frequencyRequired: string
  categoryRequired: string
  taskTitleRequired: string
  tasksRequired: string
  numberMinRequired: string
  numberMaxRequired: string
  numberRangeInvalid: string
}) {
  const taskSchema = z
    .object({
      title: z.string().trim().min(1, messages.taskTitleRequired),
      inputType: taskInputTypeSchema,
      isMandatory: z.boolean(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      unit: z.string().trim().nullable().optional(),
      options: z.array(z.string()).optional(),
    })
    .superRefine((task, ctx) => {
      if (task.inputType !== "Number") {
        return
      }

      if (
        task.min != null &&
        task.max != null &&
        task.min > task.max
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["max"],
          message: messages.numberRangeInvalid,
        })
      }
    })

  return z.object({
    unitId: z
      .string()
      .min(1, messages.unitRequired)
      .uuid(messages.unitRequired),
    name: z.string().trim().min(1, messages.nameRequired).max(200),
    description: z.string().trim().optional(),
    frequency: maintenanceFrequencySchema,
    assetCategoryId: z
      .string()
      .min(1, messages.categoryRequired)
      .uuid(messages.categoryRequired),
    isActive: z.boolean(),
    tasks: z.array(taskSchema).min(1, messages.tasksRequired),
  })
}

export type CreatePlanFormValues = z.infer<
  ReturnType<typeof createPlanFormSchema>
>

export function buildCreatePlanRequest(
  values: CreatePlanFormValues,
): CreateMaintenancePlanRequest {
  return {
    unitId: values.unitId,
    name: values.name,
    description:
      values.description && values.description.length > 0
        ? values.description
        : null,
    frequency: values.frequency,
    assetCategoryId: values.assetCategoryId,
    isActive: values.isActive,
    tasks: values.tasks.map((task, index) => ({
      title: task.title,
      inputType: task.inputType,
      isMandatory: task.isMandatory,
      order: index + 1,
      configuration: buildTaskConfiguration(task),
    })),
  }
}

function buildTaskConfiguration(
  task: CreatePlanFormValues["tasks"][number],
): string | null {
  if (task.inputType === "Number") {
    const payload: Record<string, number | string> = {}

    if (task.min != null) {
      payload.min = task.min
    }

    if (task.max != null) {
      payload.max = task.max
    }

    if (task.unit != null && task.unit.trim().length > 0) {
      payload.unit = task.unit.trim()
    }

    return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null
  }

  if (task.inputType === "SingleChoice") {
    const options = (task.options ?? [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0)

    return options.length > 0 ? JSON.stringify({ options }) : null
  }

  return null
}

export function mapGlobalTemplateTaskToFormTask(task: {
  title: string
  inputType: TaskInputType
  isMandatory: boolean
  configuration?: string | null
}): CreatePlanFormValues["tasks"][number] {
  const formTask: CreatePlanFormValues["tasks"][number] = {
    title: task.title,
    inputType: task.inputType,
    isMandatory: task.isMandatory,
    min: null,
    max: null,
    unit: null,
    options: undefined,
  }

  if (!task.configuration) {
    return formTask
  }

  try {
    const parsed: unknown = JSON.parse(task.configuration)
    if (typeof parsed !== "object" || parsed === null) {
      return formTask
    }

    const record = parsed as Record<string, unknown>

    if (typeof record.min === "number") {
      formTask.min = record.min
    }

    if (typeof record.max === "number") {
      formTask.max = record.max
    }

    if (typeof record.unit === "string") {
      formTask.unit = record.unit
    }

    if (Array.isArray(record.options)) {
      formTask.options = record.options.filter(
        (option): option is string => typeof option === "string",
      )
    }
  } catch {
    return formTask
  }

  return formTask
}
