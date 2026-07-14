import { z } from "zod"

export const assetMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  inMaintenance: z.number().int().nonnegative(),
  inactive: z.number().int().nonnegative(),
})

export type AssetMetrics = z.infer<typeof assetMetricsSchema>

export const workOrderMetricsSchema = z.object({
  totalThisMonth: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  canceled: z.number().int().nonnegative(),
})

export type WorkOrderMetrics = z.infer<typeof workOrderMetricsSchema>

export const dashboardMetricsSchema = z.object({
  assets: assetMetricsSchema,
  workOrders: workOrderMetricsSchema,
})

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>
