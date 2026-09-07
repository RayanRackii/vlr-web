import { z } from "zod"

export const tenantNotificationChannelSchema = z.enum([
  "InApp",
  "Email",
  "WhatsApp",
])

export type TenantNotificationChannel = z.infer<
  typeof tenantNotificationChannelSchema
>

export const tenantNotificationModuleSchema = z.enum(["catalog", "rentals"])

export type TenantNotificationModule = z.infer<
  typeof tenantNotificationModuleSchema
>

export const tenantNotificationChannelItemSchema = z.object({
  channel: tenantNotificationChannelSchema,
  isActive: z.boolean(),
  configurable: z.boolean(),
})

export type TenantNotificationChannelItem = z.infer<
  typeof tenantNotificationChannelItemSchema
>

export const tenantNotificationEventSchema = z.object({
  eventType: z.string().min(1),
  displayKey: z.string().min(1),
  channels: z.array(tenantNotificationChannelItemSchema),
})

export type TenantNotificationEvent = z.infer<
  typeof tenantNotificationEventSchema
>

export const tenantNotificationChannelGroupSchema = z.object({
  module: tenantNotificationModuleSchema,
  events: z.array(tenantNotificationEventSchema),
})

export type TenantNotificationChannelGroup = z.infer<
  typeof tenantNotificationChannelGroupSchema
>

export const tenantNotificationChannelGroupListSchema = z.array(
  tenantNotificationChannelGroupSchema,
)

export const updateTenantNotificationChannelResponseSchema = z.object({
  eventType: z.string(),
  channel: tenantNotificationChannelSchema,
  isActive: z.boolean(),
})

export type UpdateTenantNotificationChannelResponse = z.infer<
  typeof updateTenantNotificationChannelResponseSchema
>
