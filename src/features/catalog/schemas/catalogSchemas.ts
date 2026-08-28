import { z } from "zod"

export const catalogFileVisibilitySchema = z.enum([
  "CustomerVisible",
  "InternalB2B",
])

export type CatalogFileVisibility = z.infer<typeof catalogFileVisibilitySchema>

export const catalogOrderStatusSchema = z.enum([
  "Requested",
  "Approved",
  "Preparing",
  "Ready",
  "Completed",
  "Rejected",
  "Cancelled",
])

export type CatalogOrderStatus = z.infer<typeof catalogOrderStatusSchema>

export const catalogActorTypeSchema = z.enum(["Customer", "B2BUser", "System"])

export const productRequestStatusSchema = z.enum(["Submitted"])

export const notificationChannelSchema = z.enum([
  "InApp",
  "Email",
  "WhatsApp",
  "Sms",
])

export type NotificationChannel = z.infer<typeof notificationChannelSchema>

export const notificationRecipientKindSchema = z.enum(["Customer", "B2BUser"])

export const notificationDeliveryStatusSchema = z.enum([
  "Queued",
  "Sent",
  "Delivered",
  "Failed",
])

export type NotificationDeliveryStatus = z.infer<
  typeof notificationDeliveryStatusSchema
>

export const catalogProductFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  visibility: catalogFileVisibilitySchema,
  url: z.string().nullable(),
})

export type CatalogProductFile = z.infer<typeof catalogProductFileSchema>

export const catalogProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  files: z.array(catalogProductFileSchema),
})

export type CatalogProduct = z.infer<typeof catalogProductSchema>

export const catalogProductListSchema = z.array(catalogProductSchema)

export const catalogFileUrlSchema = z.object({
  url: z.string(),
  isPublic: z.boolean(),
})

export type CatalogFileUrl = z.infer<typeof catalogFileUrlSchema>

export const catalogProductFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(80),
  description: z.string().trim().max(4000),
  price: z.string().trim(),
  currency: z.string().trim().length(3),
})

export type CatalogProductFormValues = z.infer<typeof catalogProductFormSchema>

export const catalogOrderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productCode: z.string().nullable(),
  unitPrice: z.number().nullable(),
  currency: z.string(),
  quantity: z.number(),
  subTotal: z.number().nullable(),
})

export const catalogOrderHistorySchema = z.object({
  id: z.string().uuid(),
  status: catalogOrderStatusSchema,
  actorType: catalogActorTypeSchema,
  actorId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
})

export const catalogOrderSchema = z.object({
  id: z.string().uuid(),
  displayNumber: z.string(),
  orderNumber: z.number(),
  status: catalogOrderStatusSchema,
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  customerNote: z.string().nullable(),
  totalAmount: z.number().nullable(),
  currency: z.string(),
  rejectedReason: z.string().nullable(),
  cancelledReason: z.string().nullable(),
  createdAt: z.string(),
  items: z.array(catalogOrderItemSchema),
  history: z.array(catalogOrderHistorySchema),
})

export type CatalogOrder = z.infer<typeof catalogOrderSchema>

export const catalogOrderListSchema = z.array(catalogOrderSchema)

export const catalogReasonFormSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
})

export type CatalogReasonFormValues = z.infer<typeof catalogReasonFormSchema>

export const productRequestFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
})

export const productRequestSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  description: z.string(),
  quantity: z.number(),
  note: z.string().nullable(),
  status: productRequestStatusSchema,
  createdAt: z.string(),
  files: z.array(productRequestFileSchema),
})

export type ProductRequest = z.infer<typeof productRequestSchema>

export const productRequestListSchema = z.array(productRequestSchema)

export const portalProductFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  url: z.string(),
})

export const portalProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string(),
  files: z.array(portalProductFileSchema),
})

export type PortalProduct = z.infer<typeof portalProductSchema>

export const portalProductListSchema = z.array(portalProductSchema)

export const productRequestFormSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  quantity: z.number().int().min(1).max(9999),
  note: z.string().trim().max(2000),
})

export type ProductRequestFormValues = z.infer<typeof productRequestFormSchema>

export const catalogNotificationDeliverySchema = z.object({
  id: z.string().uuid(),
  notificationId: z.string().uuid(),
  eventType: z.string(),
  channel: notificationChannelSchema,
  recipientKind: notificationRecipientKindSchema,
  recipientId: z.string().uuid().nullable(),
  recipientName: z.string().nullable(),
  status: notificationDeliveryStatusSchema,
  attemptCount: z.number(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
})

export type CatalogNotificationDelivery = z.infer<
  typeof catalogNotificationDeliverySchema
>

export const catalogNotificationDeliveryListSchema = z.array(
  catalogNotificationDeliverySchema,
)

export const catalogChannelConfigSchema = z.object({
  eventType: z.string(),
  channel: notificationChannelSchema,
  isActive: z.boolean(),
})

export type CatalogChannelConfig = z.infer<typeof catalogChannelConfigSchema>

export const catalogChannelConfigListSchema = z.array(catalogChannelConfigSchema)

export const CATALOG_EVENT_TYPES = [
  "catalog.order.created",
  "catalog.order.approved",
  "catalog.order.preparing",
  "catalog.order.ready",
  "catalog.order.rejected",
  "catalog.order.cancelled_by_supplier",
] as const

export type CatalogEventType = (typeof CATALOG_EVENT_TYPES)[number]

export const NOTIFICATION_CHANNELS = [
  "InApp",
  "Email",
  "WhatsApp",
  "Sms",
] as const

export const B2B_ORDER_ACTIONS: Record<
  CatalogOrderStatus,
  readonly B2BOrderAction[]
> = {
  Requested: ["approve", "reject", "cancel"],
  Approved: ["preparing", "cancel"],
  Preparing: ["ready", "cancel"],
  Ready: ["complete", "cancel"],
  Completed: [],
  Rejected: [],
  Cancelled: [],
}

export type B2BOrderAction =
  | "approve"
  | "reject"
  | "preparing"
  | "ready"
  | "complete"
  | "cancel"

export function parseOptionalPrice(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return null
  }

  const normalized = trimmed.replace(",", ".")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

export function formatCatalogMoney(
  amount: number | null,
  currency: string,
  locale: string,
): string | null {
  if (amount == null) {
    return null
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatCatalogDate(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}
