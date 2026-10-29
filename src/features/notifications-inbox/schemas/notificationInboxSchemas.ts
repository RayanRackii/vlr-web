import { z } from "zod"

/**
 * Core, tenant-scoped in-app notification contract (staff/B2B only). Shapes mirror
 * `GET /api/me/notifications/summary`, `GET /api/me/notifications`, and
 * `POST /api/me/notifications/read`. `module` stays an open string so a brand new
 * module surfaces with the generic fallback label instead of failing to parse.
 */

export const notificationSummaryGroupSchema = z.object({
  eventType: z.string().min(1),
  module: z.string().min(1),
  count: z.number().int().nonnegative(),
  latestAt: z.string().min(1),
  targetRoute: z.string().min(1),
})

export type NotificationSummaryGroup = z.infer<
  typeof notificationSummaryGroupSchema
>

export const notificationSummarySchema = z.object({
  unreadTotal: z.number().int().nonnegative(),
  groups: z.array(notificationSummaryGroupSchema),
})

export type NotificationSummary = z.infer<typeof notificationSummarySchema>

export const notificationItemSchema = z.object({
  id: z.string().min(1),
  eventType: z.string().min(1),
  module: z.string().min(1),
  aggregateType: z.string().nullable().optional(),
  aggregateId: z.string().nullable().optional(),
  title: z.string(),
  createdAt: z.string().min(1),
  readAt: z.string().nullable(),
  targetRoute: z.string().min(1),
})

export type NotificationItem = z.infer<typeof notificationItemSchema>

export const notificationListSchema = z.object({
  items: z.array(notificationItemSchema),
  nextCursor: z.string().nullable(),
})

export type NotificationList = z.infer<typeof notificationListSchema>

export const markReadResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
})

export type MarkReadResponse = z.infer<typeof markReadResponseSchema>
