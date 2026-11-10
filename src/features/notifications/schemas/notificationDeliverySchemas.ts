import { z } from "zod"

import {
  catalogNotificationDeliverySchema,
  notificationChannelSchema,
  notificationDeliveryStatusSchema,
  notificationRecipientKindSchema,
} from "@/features/catalog/schemas/catalogSchemas"

export const notificationDeliverySchema = catalogNotificationDeliverySchema
  .omit({ eventType: true })
  .extend({
    eventKey: z.string().min(1),
    module: z.string().nullish(),
  })

export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>

export const notificationDeliveryPageSchema = z.object({
  items: z.array(notificationDeliverySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalCount: z.number().int(),
})

export type NotificationDeliveryPage = z.infer<typeof notificationDeliveryPageSchema>

export const NOTIFICATION_DELIVERY_PAGE_SIZE = 20
export const NOTIFICATION_DELIVERY_MAX_PAGE_SIZE = 50

export { notificationChannelSchema, notificationDeliveryStatusSchema, notificationRecipientKindSchema }
