import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { customerApi } from "@/lib/api"
import i18n from "@/lib/i18n"
import { PORTAL_PRODUCT_REQUEST_PAGE_SIZE } from "@/features/catalog/schemas/catalogSchemas"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    customerApi: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    },
  }
})

import {
  getPortalProductRequest,
  listPortalProductRequests,
} from "@/features/catalog/services/catalogPortalService"

const REQUEST_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
const FILE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

const portalItem = {
  id: REQUEST_ID,
  status: "Submitted",
  description: "Replacement gasket",
  quantity: 2,
  createdAt: "2026-10-18T16:00:00+00:00",
  files: [
    {
      id: FILE_ID,
      fileName: "gasket.pdf",
      url: "https://signed.example/catalog-private/gasket.pdf",
    },
  ],
}

const customerGet = vi.mocked(customerApi.get)

function apiError(status: number, data: unknown): AxiosError {
  return new AxiosError("error", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("listPortalProductRequests", () => {
  beforeEach(() => {
    customerGet.mockReset()
  })

  it("requests the newest page with the default page size", async () => {
    customerGet.mockResolvedValue({
      data: {
        items: [portalItem],
        page: 2,
        pageSize: PORTAL_PRODUCT_REQUEST_PAGE_SIZE,
        total: 21,
      },
    })

    const result = await listPortalProductRequests(2)

    expect(customerGet).toHaveBeenCalledWith(
      "/api/catalog/portal/product-requests",
      {
        params: { page: 2, pageSize: PORTAL_PRODUCT_REQUEST_PAGE_SIZE },
      },
    )
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") {
      return
    }
    expect(result.page.items[0]?.description).toBe("Replacement gasket")
    expect(result.page.items[0]?.files[0]?.url).toContain("https://")
    expect(result.page.total).toBe(21)
  })

  it("returns unavailable for 404 and 501 instead of an empty inbox", async () => {
    customerGet.mockRejectedValueOnce(apiError(404, "<html>missing</html>"))
    await expect(listPortalProductRequests(3)).resolves.toEqual({
      kind: "unavailable",
    })

    customerGet.mockRejectedValueOnce(apiError(501, { error: "Not implemented." }))
    await expect(listPortalProductRequests()).resolves.toEqual({
      kind: "unavailable",
    })
  })

  it("still surfaces module and server errors", async () => {
    customerGet.mockRejectedValueOnce(
      apiError(403, { error: "Module is not active for this tenant." }),
    )
    await expect(listPortalProductRequests()).rejects.toThrow(
      "Este módulo não está ativo neste ambiente.",
    )

    customerGet.mockRejectedValueOnce(apiError(500, null))
    await expect(listPortalProductRequests()).rejects.toThrow(
      i18n.t("apiErrors.loadPortalProductRequests"),
    )
  })

  it("rejects a payload that is not the paged contract", async () => {
    customerGet.mockResolvedValue({ data: { items: [] } })
    await expect(listPortalProductRequests()).rejects.toThrow(
      i18n.t("apiErrors.invalidPayload"),
    )
  })
})

describe("getPortalProductRequest", () => {
  beforeEach(() => {
    customerGet.mockReset()
  })

  it("returns one request for the signed-in customer", async () => {
    customerGet.mockResolvedValue({ data: portalItem })

    const request = await getPortalProductRequest(REQUEST_ID)

    expect(customerGet).toHaveBeenCalledWith(
      `/api/catalog/portal/product-requests/${REQUEST_ID}`,
    )
    expect(request.quantity).toBe(2)
    expect(request.files).toHaveLength(1)
  })

  it("turns another customer's 404 into the not-found message", async () => {
    customerGet.mockRejectedValue(apiError(404, ""))
    await expect(getPortalProductRequest(REQUEST_ID)).rejects.toThrow(
      i18n.t("tenantPortal.catalog.requestNotFound"),
    )
  })

  it("does not treat a 501 on the detail route as not found", async () => {
    customerGet.mockRejectedValue(apiError(501, null))
    await expect(getPortalProductRequest(REQUEST_ID)).rejects.toThrow(
      i18n.t("apiErrors.loadPortalProductRequest"),
    )
  })
})

 it.each(["note", "observation"] as const)("preserves the %s returned by the API", async (field) => {
   customerGet.mockResolvedValue({ data: { ...portalItem, [field]: "Handle carefully" } })
   expect((await getPortalProductRequest(REQUEST_ID))[field]).toBe("Handle carefully")
 })
