import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, customerApi } from "@/lib/api"
import i18n from "@/lib/i18n"
import { getCatalogPolicy, saveCatalogPolicy } from "./catalogService"
import { cancelPortalCatalogOrder, cancelPortalProductRequest, getPortalCatalogPolicy } from "./catalogPortalService"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { get: vi.fn(), put: vi.fn() },
  customerApi: { get: vi.fn(), post: vi.fn() },
}))
const policy = { customerCanCancelOrders: true, orderCancelableUpToStatus: "Approved" as const, customerCanCancelRequests: true, requestCancelableUpToStatus: "Submitted" as const, cancellationPolicyText: "No refunds" }
const portalPolicy = { canCancelOrders: true, canCancelRequests: true, upToStatus: { orders: "Approved", requests: "Submitted" }, policyText: "No refunds" }
const id = "11111111-1111-4111-8111-111111111111"
function serverError(status: number) {
  return new AxiosError("error", undefined, undefined, undefined, { status, statusText: "Error", data: { error: "Cancellation is no longer allowed." }, headers: {}, config: { headers: {} } as InternalAxiosRequestConfig })
}
describe("catalog policy API contract", () => {
  beforeEach(() => vi.resetAllMocks())
  it("uses the staff client and the exact full-replacement payload", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: policy })
    vi.mocked(api.put).mockResolvedValue({ data: policy })
    expect(await getCatalogPolicy()).toEqual(policy)
    expect(api.get).toHaveBeenCalledWith("/api/catalog/policy")
    expect(await saveCatalogPolicy(policy)).toEqual(policy)
    expect(api.put).toHaveBeenCalledWith("/api/catalog/policy", policy)
  })
  it("reads portal policy through the customer client", async () => {
    vi.mocked(customerApi.get).mockResolvedValue({ data: portalPolicy })
    expect(await getPortalCatalogPolicy()).toEqual(portalPolicy)
    expect(customerApi.get).toHaveBeenCalledWith("/api/catalog/portal/policy")
  })
  it("rejects incomplete policy responses instead of assuming defaults", async () => {
    vi.mocked(customerApi.get).mockResolvedValue({ data: { canCancelOrders: true } })
    await expect(getPortalCatalogPolicy()).rejects.toThrow(i18n.t("apiErrors.invalidPayload"))
    vi.mocked(api.get).mockResolvedValue({ data: { ...policy, orderCancelableUpToStatus: "Cancelled" } })
    await expect(getCatalogPolicy()).rejects.toThrow(i18n.t("apiErrors.invalidPayload"))
  })
  it("parses the mutation request DTO without requiring read-model file URLs", async () => {
    const result = { id, customerId: id, description: "Replacement part", quantity: 1, note: null, status: "Cancelled", createdAt: "2026-10-20T12:00:00Z", files: [{ id, fileName: "part.pdf", mimeType: "application/pdf", sizeBytes: 42 }] }
    vi.mocked(customerApi.post).mockResolvedValue({ data: result })
    expect(await cancelPortalProductRequest(id)).toEqual(result)
    expect(customerApi.post).toHaveBeenCalledWith(`/api/catalog/portal/product-requests/${id}/cancel`)
  })
  for (const status of [400, 409]) {
    it(`handles cancellation errors on ${status}`, async () => {
      vi.mocked(customerApi.post).mockRejectedValue(serverError(status))
      await expect(cancelPortalCatalogOrder(id)).rejects.toThrow(status === 409 ? i18n.t("tenantPortal.catalog.orderNoLongerCancellable") : "Cancellation is no longer allowed.")
      await expect(cancelPortalProductRequest(id)).rejects.toThrow("Cancellation is no longer allowed.")
      expect(customerApi.post).toHaveBeenCalledWith(`/api/catalog/portal/orders/${id}/cancel`)
      expect(customerApi.post).toHaveBeenCalledWith(`/api/catalog/portal/product-requests/${id}/cancel`)
    })
  }
})
