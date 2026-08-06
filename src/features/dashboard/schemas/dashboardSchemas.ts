import { z } from "zod"

export const customerActivityMetricsSchema = z.object({
  loggedInToday: z.number().int().nonnegative(),
  loggedInLast7Days: z.number().int().nonnegative(),
  loggedInLast30Days: z.number().int().nonnegative(),
  totalCustomers: z.number().int().nonnegative(),
})

export type CustomerActivityMetrics = z.infer<
  typeof customerActivityMetricsSchema
>

export const assetFamilyCountSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
})

export const assetMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  inMaintenance: z.number().int().nonnegative(),
  inactive: z.number().int().nonnegative(),
  byFamily: z.array(assetFamilyCountSchema),
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

export const pmocMetricsSchema = z.object({
  activePlans: z.number().int().nonnegative(),
  workOrdersFromPlansThisMonth: z.number().int().nonnegative(),
  electricalTotal: z.number().int().nonnegative().nullable(),
})

export const maintenanceMetricsSchema = z.object({
  assetsInMaintenance: z.number().int().nonnegative(),
  openWorkOrders: z.number().int().nonnegative(),
})

export const rentalsMetricsSchema = z.object({
  reservationsTodayPendingDeposit: z.number().int().nonnegative(),
  reservationsTodayConfirmed: z.number().int().nonnegative(),
  reservationsTodayCanceled: z.number().int().nonnegative(),
  reservationsTodayCompleted: z.number().int().nonnegative(),
  confirmationRateLast7Days: z.number(),
  slotsAvailableToday: z.number().int().nonnegative(),
  slotsBookedToday: z.number().int().nonnegative(),
  reservedRevenueThisMonth: z.number(),
  rentableSpaces: z.number().int().nonnegative(),
  rentableGoods: z.number().int().nonnegative(),
})

export const dashboardMetricsSchema = z.object({
  customerActivity: customerActivityMetricsSchema,
  assets: assetMetricsSchema.nullable(),
  workOrders: workOrderMetricsSchema.nullable(),
  pmoc: pmocMetricsSchema.nullable(),
  maintenance: maintenanceMetricsSchema.nullable(),
  rentals: rentalsMetricsSchema.nullable(),
})

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>
