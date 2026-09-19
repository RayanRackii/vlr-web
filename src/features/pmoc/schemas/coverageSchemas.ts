import { z } from "zod"

import { maintenanceFrequencyResponseSchema } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { workOrderStatusResponseSchema } from "@/features/workOrders/schemas/workOrderSchemas"

export const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a civil yyyy-MM-dd date")

export const pmocOperationalStatusValues = [
  "NeverExecuted",
  "OnTrack",
  "Overdue",
] as const

export const pmocOperationalStatusSchema = z.enum(pmocOperationalStatusValues)

export type PmocOperationalStatus = z.infer<typeof pmocOperationalStatusSchema>

const pmocOperationalStatusByIndex = [
  "NeverExecuted",
  "OnTrack",
  "Overdue",
] as const satisfies readonly PmocOperationalStatus[]

export const pmocOperationalStatusResponseSchema = z.union([
  pmocOperationalStatusSchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 | 2 =>
        value >= 0 && value < pmocOperationalStatusByIndex.length,
    )
    .transform((value) => pmocOperationalStatusByIndex[value]),
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
  lastMaintenance: maintenancePlanLastMaintenanceSchema.nullable(),
  nextDueDate: civilDateSchema,
  operationalStatus: pmocOperationalStatusResponseSchema,
  openWorkOrder: maintenancePlanOpenWorkOrderSchema.nullable(),
})

export type MaintenancePlanCoverageAssetItem = z.infer<
  typeof maintenancePlanCoverageAssetItemSchema
>

export const maintenancePlanCoverageSummarySchema = z.object({
  eligibleAssets: z.number().int().nonnegative(),
  assetsWithPmocHistory: z.number().int().nonnegative(),
  assetsNeverExecuted: z.number().int().nonnegative(),
  assetsOverdue: z.number().int().nonnegative(),
  assetsOnTrack: z.number().int().nonnegative(),
  assetsWithOpenWorkOrder: z.number().int().nonnegative(),
})

export type MaintenancePlanCoverageSummary = z.infer<
  typeof maintenancePlanCoverageSummarySchema
>

export const maintenancePlanCoverageSchema = z
  .object({
    planId: z.string().uuid(),
    asOfDate: civilDateSchema,
    frequency: maintenanceFrequencyResponseSchema,
    lastDueDate: civilDateSchema,
    nextDueDate: civilDateSchema,
    isActive: z.boolean(),
    autoGenerateEnabled: z.boolean(),
    isDueToday: z.boolean(),
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
