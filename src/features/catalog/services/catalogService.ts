import { catalogPolicySchema, type CatalogPolicy } from "@/features/catalog/schemas/catalogPolicySchemas"
import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError } from "@/lib/api"
import { localizeCatalogApiError } from "@/features/catalog/lib/catalogApiErrors"
import {
  catalogAgendaItemListSchema,
  catalogChannelConfigListSchema,
  catalogChannelConfigSchema,
  catalogFileUrlSchema,
  catalogNotificationDeliveryListSchema,
  catalogNotificationDeliverySchema,
  catalogOrderAllocationPreviewResponseSchema,
  catalogOrderListSchema,
  catalogOrderSchema,
  catalogProductFileSchema,
  catalogProductListSchema,
  catalogProductResourceRequirementsResponseSchema,
  catalogProductSchema,
  catalogResourceAgendaResponseSchema,
  catalogAuditEntryListSchema,
  catalogProductAccessSchema,
  customerGroupListSchema,
  customerGroupSchema,
  productRequestListSchema,
  type AllocationUsageAction,
  type CatalogAuditEntry,
  type CatalogProductAccess,
  type CatalogProductVisibility,
  type CustomerGroup,
  type CatalogAgendaItem,
  type CatalogResourceAgendaResponse,
  type CatalogChannelConfig,
  type CatalogFileUrl,
  type CatalogFileVisibility,
  type CatalogNotificationDelivery,
  type CatalogOrder,
  type CatalogOrderAllocationPreview,
  type CatalogOrderStatus,
  type CatalogProduct,
  type CatalogProductFile,
  type CatalogProductResourceRequirement,
  type CatalogProductResourceRequirementsResponse,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type ProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import { taxonomyQueryParams, type TaxonomyQuery } from "@/features/taxonomy/lib/taxonomyQuery"

export type CatalogProductQuery = {
  name?: string
  code?: string
  isActive?: boolean
} & TaxonomyQuery

export type CatalogProductWriteRequest = {
  name: string
  code?: string | null
  description?: string | null
  price?: number | null
  currency?: string
  taxonomy?: { categoryIds: string[]; tagIds: string[] }
}

function throwCatalogError(error: unknown, fallbackKey: string): never {
  const message = localizeCatalogApiError(
    getAxiosErrorPayload(error),
    i18n.t(fallbackKey),
  )
  if (isRetryableCatalogError(error)) {
    throw new CatalogRetryableError(message, { cause: error })
  }
  throw new Error(message)
}

/** Thrown on 409 planning_version_conflict so callers can reload instead of just toasting. */
export class CatalogPlanningVersionConflictError extends Error {}

/** Thrown on HTTP 403 so callers can show a friendly permission message instead of a raw code. */
export class CatalogForbiddenError extends Error {}

/**
 * Network failures and 5xx responses are transient: callers should surface the
 * message but let the user retry rather than disabling the action. A business
 * refusal (4xx) stays a plain Error so callers can block the retry.
 */
export class CatalogRetryableError extends Error {}

function isRetryableCatalogError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }
  const status = error.response?.status
  return status == null || status >= 500
}

function isForbidden(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403
}

function isConflict(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409
}

function isPlanningVersionConflict(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 409) {
    return false
  }
  const payload = getAxiosErrorPayload(error)
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { code?: unknown }).code === "planning_version_conflict"
  )
}

function hasCatalogErrorCode(error: unknown, code: string): boolean {
  if (!isAxiosError(error)) {
    return false
  }
  const payload = getAxiosErrorPayload(error)
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { code?: unknown }).code === code
  )
}

function parseOrThrow<T>(
  parsed: { success: true; data: T } | { success: false },
): T {
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function listCatalogProducts(
  query?: CatalogProductQuery,
  options?: { signal?: AbortSignal },
): Promise<CatalogProduct[]> {
  try {
    const { category, tags, ...rest } = query ?? {}
    const response = await api.get("/api/catalog/products", {
      params: { ...rest, ...taxonomyQueryParams({ category, tags }) },
      ...(options?.signal ? { signal: options.signal } : {}),
    })
    return parseOrThrow(catalogProductListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogProducts")
  }
}

export async function getCatalogProduct(id: string): Promise<CatalogProduct> {
  try {
    const response = await api.get(`/api/catalog/products/${id}`)
    return parseOrThrow(catalogProductSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogProduct")
  }
}

export async function createCatalogProduct(body: CatalogProductWriteRequest): Promise<CatalogProduct> {
  try {
    const response = await api.post("/api/catalog/products", body)
    return parseOrThrow(catalogProductSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.saveCatalogProduct")
  }
}

export async function updateCatalogProduct(
  id: string,
  body: CatalogProductWriteRequest,
): Promise<CatalogProduct> {
  try {
    const response = await api.put(`/api/catalog/products/${id}`, body)
    return parseOrThrow(catalogProductSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.saveCatalogProduct")
  }
}

export async function deactivateCatalogProduct(
  id: string,
): Promise<CatalogProduct> {
  try {
    const response = await api.post(`/api/catalog/products/${id}/deactivate`)
    return parseOrThrow(catalogProductSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.updateCatalogProductStatus")
  }
}

export async function activateCatalogProduct(
  id: string,
): Promise<CatalogProduct> {
  try {
    const response = await api.post(`/api/catalog/products/${id}/activate`)
    return parseOrThrow(catalogProductSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.updateCatalogProductStatus")
  }
}

export async function uploadCatalogProductFile(
  productId: string,
  file: File,
  visibility: CatalogFileVisibility,
): Promise<CatalogProductFile> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("visibility", visibility)

  try {
    const response = await api.post(
      `/api/catalog/products/${productId}/files`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    )
    return parseOrThrow(catalogProductFileSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.uploadCatalogFile")
  }
}

export async function deleteCatalogProductFile(
  productId: string,
  fileId: string,
): Promise<void> {
  try {
    await api.delete(`/api/catalog/products/${productId}/files/${fileId}`)
  } catch (error) {
    throwCatalogError(error, "apiErrors.deleteCatalogFile")
  }
}

export async function getCatalogProductFileUrl(
  productId: string,
  fileId: string,
): Promise<CatalogFileUrl> {
  try {
    const response = await api.get(
      `/api/catalog/products/${productId}/files/${fileId}/url`,
    )
    return parseOrThrow(catalogFileUrlSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogFileUrl")
  }
}

export async function getCatalogProductResourceRequirements(
  productId: string,
): Promise<CatalogProductResourceRequirementsResponse> {
  try {
    const response = await api.get(`/api/catalog/products/${productId}/resource-requirements`)
    return parseOrThrow(
      catalogProductResourceRequirementsResponseSchema.safeParse(response.data),
    )
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.resourcePlanning.errors.loadRequirements")
  }
}

export async function replaceCatalogProductResourceRequirements(
  productId: string,
  body: { expectedVersion: number; requirements: CatalogProductResourceRequirement[] },
): Promise<CatalogProductResourceRequirementsResponse> {
  try {
    const response = await api.put(
      `/api/catalog/products/${productId}/resource-requirements`,
      body,
    )
    return parseOrThrow(
      catalogProductResourceRequirementsResponseSchema.safeParse(response.data),
    )
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    if (isPlanningVersionConflict(error)) {
      throw new CatalogPlanningVersionConflictError(
        localizeCatalogApiError(
          getAxiosErrorPayload(error),
          i18n.t("catalog.resourcePlanning.errors.saveRequirements"),
        ),
      )
    }
    if (hasCatalogErrorCode(error, "unsupported_requirement_scope")) {
      throw new Error(i18n.t("catalog.resourcePlanning.errors.singleRequirementOnly"), {
        cause: error,
      })
    }
    throwCatalogError(error, "catalog.resourcePlanning.errors.saveRequirements")
  }
}

export async function listProductRequests(options?: { signal?: AbortSignal }): Promise<ProductRequest[]> {
  try {
    const response = await api.get("/api/catalog/product-requests", options?.signal ? { signal: options.signal } : undefined)
    return parseOrThrow(productRequestListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadProductRequests")
  }
}

export async function listCatalogOrders(query?: {
  orderNumber?: number
  status?: CatalogOrderStatus
  customerId?: string
  from?: string
  to?: string
}): Promise<CatalogOrder[]> {
  try {
    const response = await api.get("/api/catalog/orders", { params: query })
    return parseOrThrow(catalogOrderListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogOrders")
  }
}

export type CatalogAgendaRange = {
  /** ISO instants; the API caps the span at 42 days. */
  from: string
  to: string
}

export async function listCatalogProductAgenda(
  query: CatalogAgendaRange & { productId?: string },
  options?: { signal?: AbortSignal },
): Promise<CatalogAgendaItem[]> {
  try {
    const response = await api.get("/api/catalog/agenda/products", {
      params: query,
      ...(options?.signal ? { signal: options.signal } : {}),
    })
    return parseOrThrow(catalogAgendaItemListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogAgenda")
  }
}

export async function listCatalogResourceAgenda(
  query: CatalogAgendaRange & { rentalAssetId?: string },
  options?: { signal?: AbortSignal },
): Promise<CatalogResourceAgendaResponse> {
  try {
    const response = await api.get("/api/catalog/agenda/resources", {
      params: query,
      ...(options?.signal ? { signal: options.signal } : {}),
    })
    return parseOrThrow(catalogResourceAgendaResponseSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogAgenda")
  }
}

export async function getCatalogOrder(id: string): Promise<CatalogOrder> {
  try {
    const response = await api.get(`/api/catalog/orders/${id}`)
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogOrder")
  }
}

async function postOrderTransition(
  id: string,
  action: "approve" | "preparing" | "ready" | "complete",
): Promise<CatalogOrder> {
  try {
    const response = await api.post(`/api/catalog/orders/${id}/${action}`)
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.transitionCatalogOrder")
  }
}

export function approveCatalogOrder(id: string): Promise<CatalogOrder> {
  return postOrderTransition(id, "approve")
}

export async function previewCatalogOrderAllocation(
  id: string,
  body: { unitId: string; workStarts: { orderItemId: string; workStart: string }[] },
): Promise<CatalogOrderAllocationPreview> {
  try {
    const response = await api.post(`/api/catalog/orders/${id}/allocation-preview`, body)
    return parseOrThrow(
      catalogOrderAllocationPreviewResponseSchema.safeParse(response.data),
    )
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.resourcePlanning.errors.previewFailed")
  }
}

export async function approveCatalogOrderWithPlanning(
  id: string,
  planning: { unitId: string; workStart: string; expectedVersion: number },
): Promise<CatalogOrder> {
  try {
    const response = await api.post(`/api/catalog/orders/${id}/approve`, planning)
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    if (isPlanningVersionConflict(error)) {
      throw new CatalogPlanningVersionConflictError(
        localizeCatalogApiError(getAxiosErrorPayload(error), i18n.t("apiErrors.transitionCatalogOrder")),
      )
    }
    if (isForbidden(error)) {
      throw new CatalogForbiddenError(i18n.t("catalog.resourcePlanning.errors.forbidden"), { cause: error })
    }
    throwCatalogError(error, "apiErrors.transitionCatalogOrder")
  }
}

export async function applyCatalogOrderAllocationUsage(
  orderId: string,
  allocationId: string,
  action: AllocationUsageAction,
  expectedVersion: number,
): Promise<CatalogOrder> {
  try {
    const response = await api.post(
      `/api/catalog/orders/${orderId}/allocations/${allocationId}/usage`,
      { action, expectedVersion },
    )
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.resourcePlanning.errors.usageActionFailed")
  }
}

export function startPreparingCatalogOrder(id: string): Promise<CatalogOrder> {
  return postOrderTransition(id, "preparing")
}

export function markCatalogOrderReady(id: string): Promise<CatalogOrder> {
  return postOrderTransition(id, "ready")
}

export function completeCatalogOrder(id: string): Promise<CatalogOrder> {
  return postOrderTransition(id, "complete")
}

export async function rejectCatalogOrder(
  id: string,
  reason: string,
): Promise<CatalogOrder> {
  try {
    const response = await api.post(`/api/catalog/orders/${id}/reject`, {
      reason,
    })
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.transitionCatalogOrder")
  }
}

export async function cancelCatalogOrder(
  id: string,
  reason: string,
): Promise<CatalogOrder> {
  try {
    const response = await api.post(`/api/catalog/orders/${id}/cancel`, {
      reason,
    })
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.transitionCatalogOrder")
  }
}

export async function listCatalogNotifications(query?: {
  from?: string
  to?: string
  eventType?: string
  recipientKind?: "Customer" | "B2BUser"
  channel?: NotificationChannel
  status?: NotificationDeliveryStatus
}): Promise<CatalogNotificationDelivery[]> {
  try {
    const response = await api.get("/api/catalog/notifications", {
      params: query,
    })
    return parseOrThrow(
      catalogNotificationDeliveryListSchema.safeParse(response.data),
    )
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogNotifications")
  }
}

export async function resendCatalogNotification(
  deliveryId: string,
): Promise<CatalogNotificationDelivery> {
  try {
    const response = await api.post(
      `/api/catalog/notifications/deliveries/${deliveryId}/resend`,
    )
    return parseOrThrow(
      catalogNotificationDeliverySchema.safeParse(response.data),
    )
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.resendCatalogNotification")
  }
}

export async function listCatalogNotificationChannels(): Promise<
  CatalogChannelConfig[]
> {
  try {
    const response = await api.get("/api/catalog/notification-channels")
    return parseOrThrow(catalogChannelConfigListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.loadCatalogChannels")
  }
}

export async function upsertCatalogNotificationChannel(body: {
  eventType: string
  channel: NotificationChannel
  isActive: boolean
}): Promise<CatalogChannelConfig> {
  try {
    const response = await api.put("/api/catalog/notification-channels", body)
    return parseOrThrow(catalogChannelConfigSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "apiErrors.saveCatalogChannel")
  }
}

const CUSTOMER_GROUPS_PATH = "/api/catalog/customer-groups"

/** Thrown on 409 when a group name already exists (case-insensitive) so the UI can hint inline. */
export class CatalogDuplicateGroupNameError extends Error {}

export async function listCustomerGroups(
  options?: { signal?: AbortSignal },
): Promise<CustomerGroup[]> {
  try {
    const response = await api.get(CUSTOMER_GROUPS_PATH, {
      ...(options?.signal ? { signal: options.signal } : {}),
    })
    return parseOrThrow(customerGroupListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.load")
  }
}

export async function getCustomerGroup(id: string): Promise<CustomerGroup> {
  try {
    const response = await api.get(`${CUSTOMER_GROUPS_PATH}/${id}`)
    return parseOrThrow(customerGroupSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.load")
  }
}

function throwOnDuplicateGroupName(error: unknown): void {
  if (isConflict(error)) {
    throw new CatalogDuplicateGroupNameError(
      i18n.t("catalog.customerGroups.errors.duplicateName"),
    )
  }
}

export async function createCustomerGroup(body: {
  name: string
  description?: string | null
}): Promise<CustomerGroup> {
  try {
    const response = await api.post(CUSTOMER_GROUPS_PATH, body)
    return parseOrThrow(customerGroupSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwOnDuplicateGroupName(error)
    throwCatalogError(error, "catalog.customerGroups.errors.save")
  }
}

export async function updateCustomerGroup(
  id: string,
  body: { name: string; description?: string | null },
): Promise<CustomerGroup> {
  try {
    const response = await api.put(`${CUSTOMER_GROUPS_PATH}/${id}`, body)
    return parseOrThrow(customerGroupSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwOnDuplicateGroupName(error)
    throwCatalogError(error, "catalog.customerGroups.errors.save")
  }
}

export async function deleteCustomerGroup(id: string): Promise<void> {
  try {
    await api.delete(`${CUSTOMER_GROUPS_PATH}/${id}`)
  } catch (error) {
    throwCatalogError(error, "catalog.customerGroups.errors.delete")
  }
}

export async function addCustomerGroupMembers(
  id: string,
  customerIds: string[],
): Promise<CustomerGroup> {
  try {
    const response = await api.post(`${CUSTOMER_GROUPS_PATH}/${id}/members`, {
      customerIds,
    })
    return parseOrThrow(customerGroupSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.addMembers")
  }
}

export async function removeCustomerGroupMember(
  id: string,
  customerId: string,
): Promise<CustomerGroup> {
  try {
    const response = await api.delete(
      `${CUSTOMER_GROUPS_PATH}/${id}/members/${customerId}`,
    )
    return parseOrThrow(customerGroupSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.removeMember")
  }
}

export async function getCustomerGroupHistory(
  id: string,
): Promise<CatalogAuditEntry[]> {
  try {
    const response = await api.get(`${CUSTOMER_GROUPS_PATH}/${id}/history`)
    return parseOrThrow(catalogAuditEntryListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.loadHistory")
  }
}

/** Slice-2 product access read; added here so the service stays the single catalog contract. */
export async function getCatalogProductAccess(
  productId: string,
  options?: { signal?: AbortSignal },
): Promise<CatalogProductAccess> {
  try {
    const response = await api.get(`/api/catalog/products/${productId}/access`, {
      ...(options?.signal ? { signal: options.signal } : {}),
    })
    return parseOrThrow(catalogProductAccessSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.loadAccess")
  }
}

export async function putCatalogProductAccess(
  productId: string,
  body: {
    visibility: CatalogProductVisibility
    customerIds?: string[]
    groupIds?: string[]
  },
): Promise<CatalogProductAccess> {
  try {
    const response = await api.put(
      `/api/catalog/products/${productId}/access`,
      body,
    )
    return parseOrThrow(catalogProductAccessSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.saveAccess")
  }
}

export async function getCatalogProductAccessHistory(
  productId: string,
): Promise<CatalogAuditEntry[]> {
  try {
    const response = await api.get(
      `/api/catalog/products/${productId}/access/history`,
    )
    return parseOrThrow(catalogAuditEntryListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwCatalogError(error, "catalog.customerGroups.errors.loadHistory")
  }
}

export async function getCatalogPolicy(): Promise<CatalogPolicy> {
  try {
    const response = await api.get("/api/catalog/policy")
    return parseOrThrow(catalogPolicySchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) throw error
    throwCatalogError(error, "catalog.policy.loadError")
  }
}

export async function saveCatalogPolicy(body: CatalogPolicy): Promise<CatalogPolicy> {
  try {
    const response = await api.put("/api/catalog/policy", body)
    return parseOrThrow(catalogPolicySchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) throw error
    throwCatalogError(error, "catalog.policy.saveError")
  }
}
