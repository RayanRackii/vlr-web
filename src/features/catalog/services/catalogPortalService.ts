import { portalCatalogPolicySchema, type PortalCatalogPolicy } from "@/features/catalog/schemas/catalogPolicySchemas"
import i18n from "@/lib/i18n"
import { customerApi, getAxiosErrorPayload, isAxiosError } from "@/lib/api"
import { localizeCatalogApiError } from "@/features/catalog/lib/catalogApiErrors"
import {
  catalogFileUrlSchema,
  catalogOrderListSchema,
  catalogOrderSchema,
  portalProductListSchema,
  portalProductSchema,
  PORTAL_PRODUCT_REQUEST_PAGE_SIZE,
  portalProductRequestPageSchema,
  portalProductRequestSchema,
  productRequestSchema,
  type CatalogFileUrl,
  type CatalogOrder,
  type PortalProduct,
  type PortalProductRequest,
  type PortalProductRequestPage,
  type ProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import { taxonomyQueryParams, type TaxonomyQuery } from "@/features/taxonomy/lib/taxonomyQuery"

function throwPortalError(error: unknown, fallbackKey: string): never {
  throw new Error(
    localizeCatalogApiError(
      getAxiosErrorPayload(error),
      i18n.t(fallbackKey),
    ),
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

export type PortalCatalogQuery = TaxonomyQuery & { search?: string }

export async function listPortalCatalogProducts(
  query?: string | PortalCatalogQuery,
  options?: { signal?: AbortSignal },
): Promise<PortalProduct[]> {
  try {
    const normalized = typeof query === "string" ? { search: query } : (query ?? {})
    const search = normalized.search?.trim()
    const params = { ...(search ? { search } : {}), ...taxonomyQueryParams(normalized) }
    const response = await customerApi.get("/api/catalog/portal/products", {
      params: Object.keys(params).length > 0 ? params : undefined,
      ...(options?.signal ? { signal: options.signal } : {}),
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
  options?: { signal?: AbortSignal },
): Promise<PortalProduct> {
  try {
    const response = await customerApi.get(
      `/api/catalog/portal/products/${id}`,
      options?.signal ? { signal: options.signal } : undefined,
    )
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

export class CatalogOrderCancelConflictError extends Error {
  constructor() {
    super(i18n.t("tenantPortal.catalog.orderNoLongerCancellable"))
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
    if (isAxiosError(error) && error.response?.status === 409) {
      throw new CatalogOrderCancelConflictError()
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

/** List route from vlr-api #224. 404/501 means it is not deployed yet. */
function isPortalProductRequestListUnavailable(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }
  const status = error.response?.status
  return status === 404 || status === 501
}

export type PortalProductRequestListResult =
  | { kind: "ready"; page: PortalProductRequestPage }
  | { kind: "unavailable" }

export async function listPortalProductRequests(
  page = 1,
): Promise<PortalProductRequestListResult> {
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1
  try {
    const response = await customerApi.get(
      "/api/catalog/portal/product-requests",
      {
        params: {
          page: safePage,
          pageSize: PORTAL_PRODUCT_REQUEST_PAGE_SIZE,
        },
      },
    )
    return {
      kind: "ready",
      page: parseOrThrow(portalProductRequestPageSchema.safeParse(response.data)),
    }
  } catch (error) {
    if (isPortalProductRequestListUnavailable(error)) {
      return { kind: "unavailable" }
    }
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadPortalProductRequests")
  }
}

export async function getPortalProductRequest(
  id: string,
): Promise<PortalProductRequest> {
  try {
    const response = await customerApi.get(
      `/api/catalog/portal/product-requests/${id}`,
    )
    return parseOrThrow(portalProductRequestSchema.safeParse(response.data))
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new Error(i18n.t("tenantPortal.catalog.requestNotFound"), {
        cause: error,
      })
    }
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwPortalError(error, "apiErrors.loadPortalProductRequest")
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

export async function getPortalCatalogPolicy(): Promise<PortalCatalogPolicy> {
  try {
    const response = await customerApi.get("/api/catalog/portal/policy")
    return parseOrThrow(portalCatalogPolicySchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) throw error
    throwPortalError(error, "catalog.policy.loadError")
  }
}

export async function cancelPortalProductRequest(id: string): Promise<ProductRequest> {
  try {
    const response = await customerApi.post(`/api/catalog/portal/product-requests/${id}/cancel`)
    return parseOrThrow(productRequestSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) throw error
    throwPortalError(error, "tenantPortal.catalog.cancelRequestError")
  }
}
