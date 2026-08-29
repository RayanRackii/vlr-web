import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  catalogChannelConfigListSchema,
  catalogChannelConfigSchema,
  catalogFileUrlSchema,
  catalogNotificationDeliveryListSchema,
  catalogNotificationDeliverySchema,
  catalogOrderListSchema,
  catalogOrderSchema,
  catalogProductFileSchema,
  catalogProductListSchema,
  catalogProductSchema,
  productRequestListSchema,
  type CatalogChannelConfig,
  type CatalogFileUrl,
  type CatalogFileVisibility,
  type CatalogNotificationDelivery,
  type CatalogOrder,
  type CatalogOrderStatus,
  type CatalogProduct,
  type CatalogProductFile,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type ProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"

function throwCatalogError(error: unknown, fallbackKey: string): never {
  throw new Error(
    parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
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

export async function listCatalogProducts(query?: {
  name?: string
  code?: string
  isActive?: boolean
}): Promise<CatalogProduct[]> {
  try {
    const response = await api.get("/api/catalog/products", { params: query })
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

export async function createCatalogProduct(body: {
  name: string
  code?: string | null
  description?: string | null
  price?: number | null
  currency?: string
}): Promise<CatalogProduct> {
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
  body: {
    name: string
    code?: string | null
    description?: string | null
    price?: number | null
    currency?: string
  },
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

export async function listProductRequests(): Promise<ProductRequest[]> {
  try {
    const response = await api.get("/api/catalog/product-requests")
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
