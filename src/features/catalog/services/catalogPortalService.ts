import i18n from "@/lib/i18n"
import { customerApi, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  catalogFileUrlSchema,
  catalogOrderListSchema,
  catalogOrderSchema,
  portalProductListSchema,
  portalProductSchema,
  productRequestSchema,
  type CatalogFileUrl,
  type CatalogOrder,
  type PortalProduct,
  type ProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"

function throwPortalError(error: unknown, fallbackKey: string): never {
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

export async function listPortalCatalogProducts(
  search?: string,
): Promise<PortalProduct[]> {
  try {
    const response = await customerApi.get("/api/catalog/portal/products", {
      params: search && search.trim().length > 0 ? { search: search.trim() } : undefined,
    })
    return parseOrThrow(portalProductListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadPortalCatalog")
  }
}

export async function getPortalCatalogProduct(
  id: string,
): Promise<PortalProduct> {
  try {
    const response = await customerApi.get(`/api/catalog/portal/products/${id}`)
    return parseOrThrow(portalProductSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadPortalCatalogProduct")
  }
}

export async function createPortalCatalogOrder(body: {
  items: { productId: string; quantity: number }[]
  customerNote?: string
}): Promise<CatalogOrder> {
  try {
    const response = await customerApi.post("/api/catalog/portal/orders", body)
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.submitPortalOrder")
  }
}

export async function listPortalCatalogOrders(): Promise<CatalogOrder[]> {
  try {
    const response = await customerApi.get("/api/catalog/portal/orders")
    return parseOrThrow(catalogOrderListSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadPortalOrders")
  }
}

export async function getPortalCatalogOrder(id: string): Promise<CatalogOrder> {
  try {
    const response = await customerApi.get(`/api/catalog/portal/orders/${id}`)
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadPortalOrder")
  }
}

export async function cancelPortalCatalogOrder(
  id: string,
): Promise<CatalogOrder> {
  try {
    const response = await customerApi.post(
      `/api/catalog/portal/orders/${id}/cancel`,
    )
    return parseOrThrow(catalogOrderSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.cancelPortalOrder")
  }
}

export async function createPortalProductRequest(body: {
  description: string
  quantity: number
  note?: string
  files: File[]
}): Promise<ProductRequest> {
  const formData = new FormData()
  formData.append("description", body.description)
  formData.append("quantity", String(body.quantity))
  if (body.note && body.note.trim().length > 0) {
    formData.append("note", body.note.trim())
  }
  for (const file of body.files) {
    formData.append("files", file)
  }

  try {
    const response = await customerApi.post(
      "/api/catalog/portal/product-requests",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    )
    return parseOrThrow(productRequestSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.submitProductRequest")
  }
}

export async function getPortalProductRequestFileUrl(
  requestId: string,
  fileId: string,
): Promise<CatalogFileUrl> {
  try {
    const response = await customerApi.get(
      `/api/catalog/portal/product-requests/${requestId}/files/${fileId}/url`,
    )
    return parseOrThrow(catalogFileUrlSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadCatalogFileUrl")
  }
}
