import { z } from "zod"

import { civilDateSchema } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { workOrderStatusResponseSchema } from "@/features/workOrders/schemas/workOrderSchemas"

export { civilDateSchema }

export const pmocHistoryStatusValues = ["NeverExecuted", "Executed"] as const

export const pmocHistoryStatusSchema = z.enum(pmocHistoryStatusValues)

export type PmocHistoryStatus = z.infer<typeof pmocHistoryStatusSchema>

const pmocHistoryStatusByIndex = [
  "NeverExecuted",
  "Executed",
] as const satisfies readonly PmocHistoryStatus[]

export const pmocHistoryStatusResponseSchema = z.union([
  pmocHistoryStatusSchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 =>
        value >= 0 && value < pmocHistoryStatusByIndex.length,
    )
    .transform((value) => pmocHistoryStatusByIndex[value]),
])

export const pmocDueStatusValues = ["NotDue", "DueToday", "Overdue"] as const

export const pmocDueStatusSchema = z.enum(pmocDueStatusValues)

export type PmocDueStatus = z.infer<typeof pmocDueStatusSchema>

const pmocDueStatusByIndex = [
  "NotDue",
  "DueToday",
  "Overdue",
] as const satisfies readonly PmocDueStatus[]

export const pmocDueStatusResponseSchema = z.union([
  pmocDueStatusSchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 | 2 =>
        value >= 0 && value < pmocDueStatusByIndex.length,
    )
    .transform((value) => pmocDueStatusByIndex[value]),
])

export const maintenancePlanLastMaintenanceSchema = z.object({
  workOrderId: z.string().uuid(),
  scheduledDate: civilDateSchema,
  completedDate: z.string().nullish(),
})

export type MaintenancePlanLastMaintenance = z.infer<
  typeof maintenancePlanLastMaintenanceSchema
>

export const maintenancePlanOpenWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
  status: workOrderStatusResponseSchema,
  scheduledDate: civilDateSchema,
})

export type MaintenancePlanOpenWorkOrder = z.infer<
  typeof maintenancePlanOpenWorkOrderSchema
>

export const maintenancePlanCoverageAssetItemSchema = z.object({
  assetId: z.string().uuid(),
  name: z.string().min(1),
  tag: z.string().min(1),
  historyStatus: pmocHistoryStatusResponseSchema,
  lastMaintenance: maintenancePlanLastMaintenanceSchema.nullable(),
  effectiveNextDueDate: civilDateSchema,
  dueStatus: pmocDueStatusResponseSchema,
  needsAttention: z.boolean(),
  openWorkOrder: maintenancePlanOpenWorkOrderSchema.nullable(),
})

export type MaintenancePlanCoverageAssetItem = z.infer<
  typeof maintenancePlanCoverageAssetItemSchema
>

export const maintenancePlanCoverageSummarySchema = z.object({
  eligibleAssets: z.number().int().nonnegative(),
  assetsNeverExecuted: z.number().int().nonnegative(),
  assetsExecuted: z.number().int().nonnegative(),
  assetsNotDue: z.number().int().nonnegative(),
  assetsDueToday: z.number().int().nonnegative(),
  assetsOverdue: z.number().int().nonnegative(),
  assetsNeedingAttention: z.number().int().nonnegative(),
  assetsWithOpenWorkOrder: z.number().int().nonnegative(),
})

export type MaintenancePlanCoverageSummary = z.infer<
  typeof maintenancePlanCoverageSummarySchema
>

export const maintenancePlanCoverageSchema = z
  .object({
    planId: z.string().uuid(),
    asOfDate: civilDateSchema,
    intervalDays: z.number().int().min(1).max(3650),
    firstDueDate: civilDateSchema,
    isActive: z.boolean(),
    autoGenerateEnabled: z.boolean(),
    wouldBeConsideredByGenerator: z.boolean(),
    eligibleAssetCount: z.number().int().nonnegative(),
    summary: maintenancePlanCoverageSummarySchema,
    assets: z.array(maintenancePlanCoverageAssetItemSchema),
  })
  .superRefine((coverage, ctx) => {
    if (coverage.eligibleAssetCount !== coverage.summary.eligibleAssets) {
      ctx.addIssue({
        code: "custom",
        path: ["eligibleAssetCount"],
        message: "eligibleAssetCount must equal summary.eligibleAssets",
      })
    }
  })

export type MaintenancePlanCoverage = z.infer<
  typeof maintenancePlanCoverageSchema
>
