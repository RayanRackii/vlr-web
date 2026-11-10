import { z } from "zod"
import i18n from "@/lib/i18n"

import {
  formatLocaleCurrency,
  formatLocaleDateTime,
} from "@/lib/localeFormat"
import { taxonomyAssignmentSchema } from "@/features/taxonomy/schemas/taxonomySchemas"

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

export const productRequestStatusSchema = z.enum(["Submitted", "Cancelled"])

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

export const catalogFileStatusSchema = z.enum(["Ready", "Pending", "Failed"])

export const catalogProductFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  visibility: catalogFileVisibilitySchema,
  status: catalogFileStatusSchema.default("Ready"),
  url: z.string().nullable(),
})

export type CatalogProductFile = z.infer<typeof catalogProductFileSchema>

export const catalogProductVisibilitySchema = z.enum(["Public", "Restricted"])

export type CatalogProductVisibility = z.infer<
  typeof catalogProductVisibilitySchema
>

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
  hasFiles: z.boolean().optional(),
  taxonomy: taxonomyAssignmentSchema.optional(),
  /** Customer-group access (slice 1/2); absent on pre-feature responses. */
  visibility: catalogProductVisibilitySchema.optional().default("Public"),
  grantedCustomerCount: z.number().int().optional().default(0),
  grantedGroupCount: z.number().int().optional().default(0),
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
  taxonomy: z.object({
    categoryIds: z.array(z.string().uuid()).max(20),
    tagIds: z.array(z.string().uuid()).max(20),
  }).optional(),
})

export type CatalogProductFormValues = z.infer<typeof catalogProductFormSchema>

/** Order-resource planning (Phase 0): catalog.products.manage product requirement rows. */
export const catalogProductResourceRequirementSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  rentalAssetId: z.string().uuid().nullable(),
  assetCategoryId: z.string().uuid().nullable(),
  resourceQuantity: z.number().int().min(1),
  durationMinutesPerUnit: z.number().int().min(1),
  prepMinutes: z.number().int().min(0),
  cleanupMinutes: z.number().int().min(0),
})

export type CatalogProductResourceRequirement = z.infer<
  typeof catalogProductResourceRequirementSchema
>

export const catalogProductResourceRequirementsResponseSchema = z.object({
  expectedVersion: z.number().int(),
  requirements: z.array(catalogProductResourceRequirementSchema),
})

export type CatalogProductResourceRequirementsResponse = z.infer<
  typeof catalogProductResourceRequirementsResponseSchema
>

export const productionSummaryStatusSchema = z.enum([
  "NotRequired",
  "Unscheduled",
  "Scheduled",
  "InProgress",
  "Done",
  "Blocked",
  "Cancelled",
])

export type ProductionSummaryStatus = z.infer<
  typeof productionSummaryStatusSchema
>

export const allocationStatusSchema = z.enum([
  "Scheduled",
  "Running",
  "Cleaning",
  "Released",
  "Cancelled",
])

export type AllocationStatus = z.infer<typeof allocationStatusSchema>

export const catalogOrderItemAllocationSchema = z.object({
  id: z.string().uuid(),
  requirementId: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  status: allocationStatusSchema,
  plannedWorkStart: z.string(),
  plannedWorkEnd: z.string(),
  timeZoneId: z.string(),
  actualStartAt: z.string().nullable(),
  actualWorkFinishedAt: z.string().nullable(),
  actualReleaseAt: z.string().nullable(),
  planningRevision: z.number(),
})

export type CatalogOrderItemAllocation = z.infer<
  typeof catalogOrderItemAllocationSchema
>

export const catalogOrderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productCode: z.string().nullable(),
  unitPrice: z.number().nullable(),
  currency: z.string(),
  quantity: z.number(),
  subTotal: z.number().nullable(),
  /** Absent/legacy responses have no scheduling, so default is NotRequired. */
  productionSummary: productionSummaryStatusSchema.optional().default("NotRequired"),
  allocation: catalogOrderItemAllocationSchema.nullable().optional().default(null),
})

export const catalogOrderHistorySchema = z.object({
  id: z.string().uuid(),
  status: catalogOrderStatusSchema,
  actorType: catalogActorTypeSchema,
  actorId: z.string().uuid().nullable(),
  actorName: z.string().nullable().optional().default(null),
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
  /** Legacy/absent on pre-Phase-0 responses: default to the pre-planning contract values. */
  orderVersion: z.string().optional().default("0"),
  planningRevision: z.number().optional().default(0),
  productionSummary: productionSummaryStatusSchema.optional().default("NotRequired"),
  estimatedReadyAt: z.string().nullable().optional().default(null),
})

export type CatalogOrder = z.infer<typeof catalogOrderSchema>

export const catalogOrderListSchema = z.array(catalogOrderSchema)

export const catalogReasonFormSchema = z.object({
  reason: z.string({ error: () => i18n.t("catalog.orders.reason.empty") }).trim()
    .min(1, { error: () => i18n.t("catalog.orders.reason.empty") })
    .max(1000, { error: () => i18n.t("catalog.orders.reason.tooLong") }),
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

/** Customer portal read model. POST still returns {@link productRequestSchema}. */
export const portalProductRequestFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  url: z.string().min(1),
})

export type PortalProductRequestFile = z.infer<
  typeof portalProductRequestFileSchema
>

export const portalProductRequestSchema = z.object({
  note: z.string().nullish(),
  observation: z.string().nullish(),
  id: z.string().uuid(),
  status: z.string().trim().min(1),
  description: z.string(),
  quantity: z.number().int(),
  createdAt: z.string().min(1),
  files: z.array(portalProductRequestFileSchema),
})

export type PortalProductRequest = z.infer<typeof portalProductRequestSchema>

export const PORTAL_PRODUCT_REQUEST_PAGE_SIZE = 20

export const portalProductRequestPageSchema = z.object({
  items: z.array(portalProductRequestSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(50),
  total: z.number().int().nonnegative(),
})

export type PortalProductRequestPage = z.infer<
  typeof portalProductRequestPageSchema
>

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
  taxonomy: taxonomyAssignmentSchema.optional(),
  /** True when this product is Restricted and visible to this customer. */
  isExclusive: z.boolean().optional(),
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
  "catalog.order.cancelled_by_customer",
] as const

export type CatalogEventType = (typeof CATALOG_EVENT_TYPES)[number]

const CATALOG_EVENT_I18N_KEYS: Record<CatalogEventType, string> = {
  "catalog.order.created": "catalog.events.orderCreated",
  "catalog.order.approved": "catalog.events.orderApproved",
  "catalog.order.preparing": "catalog.events.orderPreparing",
  "catalog.order.ready": "catalog.events.orderReady",
  "catalog.order.rejected": "catalog.events.orderRejected",
  "catalog.order.cancelled_by_supplier": "catalog.events.orderCancelledBySupplier",
  "catalog.order.cancelled_by_customer": "catalog.events.orderCancelledByCustomer",
}

export function catalogEventI18nKey(eventType: string): string {
  return CATALOG_EVENT_I18N_KEYS[eventType as CatalogEventType] ?? eventType
}

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

export const catalogOrderAllocationPreviewResponseSchema = z.object({
  isFeasible: z.boolean(),
  orderItemId: z.string().uuid().nullable(),
  rentalAssetId: z.string().uuid().nullable(),
  workStart: z.string().nullable(),
  workEnd: z.string().nullable(),
  occupiedStart: z.string().nullable(),
  occupiedEnd: z.string().nullable(),
  estimatedReadyAt: z.string().nullable(),
  conflictCode: z.string().nullable(),
  reason: z.string().nullable(),
})

export type CatalogOrderAllocationPreview = z.infer<
  typeof catalogOrderAllocationPreviewResponseSchema
>

export const ALLOCATION_USAGE_ACTIONS = ["start", "work-finished", "release"] as const
export type AllocationUsageAction = (typeof ALLOCATION_USAGE_ACTIONS)[number]

/**
 * One scheduled (or unscheduled) order occurrence on the product/resource agenda.
 * `occupied` spans the full resource hold (prep + work + cleanup); `work` is the
 * inner work block. Both are nullable so unscheduled orders still list cleanly.
 */
export const catalogAgendaItemSchema = z.object({
  orderId: z.string().uuid(),
  displayNumber: z.string().nullable(),
  orderStatus: catalogOrderStatusSchema,
  productId: z.string().uuid(),
  productName: z.string(),
  rentalAssetId: z.string().uuid().nullable(),
  resourceName: z.string().nullable(),
  customerName: z.string().nullable(),
  workStart: z.string().nullable(),
  workEnd: z.string().nullable(),
  occupiedStart: z.string().nullable(),
  occupiedEnd: z.string().nullable(),
  allocationStatus: allocationStatusSchema.nullable(),
  timeZoneId: z.string(),
})

export type CatalogAgendaItem = z.infer<typeof catalogAgendaItemSchema>

export const catalogAgendaItemListSchema = z.array(catalogAgendaItemSchema)

export const catalogAgendaResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
})

export type CatalogAgendaResource = z.infer<typeof catalogAgendaResourceSchema>

/** Resource-agenda endpoint pairs the occurrences with the resource roster. */
export const catalogResourceAgendaResponseSchema = z.object({
  items: catalogAgendaItemListSchema,
  resources: z.array(catalogAgendaResourceSchema),
})

export type CatalogResourceAgendaResponse = z.infer<
  typeof catalogResourceAgendaResponseSchema
>

/** Staff customer group. `memberCustomerIds` lists the customers currently in it. */
export const customerGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  memberCustomerIds: z.array(z.string().uuid()),
  memberNames: z.record(z.string(), z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional().default(null),
})

export type CustomerGroup = z.infer<typeof customerGroupSchema>

export const customerGroupListSchema = z.array(customerGroupSchema)

export const customerGroupFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
})

export type CustomerGroupFormValues = z.infer<typeof customerGroupFormSchema>

/** Per-product access grant (used by slice 2; added here with the group service). */
export const catalogProductAccessSchema = z.object({
  productId: z.string().uuid(),
  visibility: catalogProductVisibilitySchema,
  customerIds: z.array(z.string().uuid()),
  groupIds: z.array(z.string().uuid()),
  restrictedWithoutGrants: z.boolean(),
  customerNames: z.record(z.string(), z.string()).optional(),
})

export type CatalogProductAccess = z.infer<typeof catalogProductAccessSchema>

/** Audit trail entry for groups and product access. `*Json` are opaque strings — never dumped raw. */
export const catalogAuditEntrySchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  actorType: catalogActorTypeSchema,
  actorUserId: z.string().uuid().nullable().optional().default(null),
  actorName: z.string().nullable().optional().default(null),
  beforeJson: z.string().nullable().optional().default(null),
  afterJson: z.string().nullable().optional().default(null),
  createdAt: z.string(),
})

export type CatalogAuditEntry = z.infer<typeof catalogAuditEntrySchema>

export const catalogAuditEntryListSchema = z.array(catalogAuditEntrySchema)

const CATALOG_AUDIT_ACTION_I18N_KEYS: Record<string, string> = {
  "group.created": "catalog.customerGroups.history.actions.created",
  "group.updated": "catalog.customerGroups.history.actions.updated",
  "group.deleted": "catalog.customerGroups.history.actions.deleted",
  "group.membersAdded": "catalog.customerGroups.history.actions.membersAdded",
  "group.memberRemoved": "catalog.customerGroups.history.actions.memberRemoved",
  "product.accessChanged": "catalog.customerGroups.history.actions.accessChanged",
}

/** Unknown actions fall back to a generic localized label (never the raw code). */
export function catalogAuditActionI18nKey(action: string): string {
  return CATALOG_AUDIT_ACTION_I18N_KEYS[action] ?? "catalog.customerGroups.history.actions.unknown"
}

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

  return formatLocaleCurrency(amount, currency, locale)
}

/** Catalog instants on the tenant business clock (same zone as reservations). */
export function formatCatalogDate(value: string, locale: string, timeZoneId: string): string {
  return formatLocaleDateTime(value, locale, timeZoneId)
}
