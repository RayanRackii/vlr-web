import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "payload" in error
    ) {
      return (error as { payload: unknown }).payload
    }

    return null
  }),
  isAxiosError: vi.fn(
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error &&
      (error as { isAxiosError?: boolean }).isAxiosError === true,
  ),
  parseApiError: vi.fn((payload: unknown, fallback: string) => {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
    ) {
      return (payload as { error: string }).error
    }

    return fallback
  }),
}))

const family = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "quadras",
  label: "Quadras",
  fields: [{ key: "covered", type: "boolean", required: false, label: null }],
  sortOrder: 3,
  isActive: true,
}

const apiGet = vi.mocked(api.get)
const apiPost = vi.mocked(api.post)
const apiPut = vi.mocked(api.put)
const apiDelete = vi.mocked(api.delete)

describe("adminAssetFamiliesService", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiPut.mockReset()
    apiDelete.mockReset()
  })

  it("lists active families by default and includes inactive only when asked", async () => {
    apiGet.mockResolvedValue({ data: [family] })
    const { listAdminAssetFamilies } = await import(
      "@/features/admin/services/adminAssetFamiliesService"
    )

    await listAdminAssetFamilies()
    await listAdminAssetFamilies({ includeInactive: true })

    expect(apiGet).toHaveBeenNthCalledWith(1, "/api/admin/asset-families", {
      params: undefined,
    })
    expect(apiGet).toHaveBeenNthCalledWith(2, "/api/admin/asset-families", {
      params: { includeInactive: true },
    })
  })

  it("creates, updates without a key, and deletes by id", async () => {
    apiGet.mockResolvedValue({ data: family })
    apiPost.mockResolvedValue({ data: family })
    apiPut.mockResolvedValue({ data: family })
    apiDelete.mockResolvedValue({ data: "" })

    const {
      createAdminAssetFamily,
      deleteAdminAssetFamily,
      getAdminAssetFamily,
      updateAdminAssetFamily,
    } = await import("@/features/admin/services/adminAssetFamiliesService")

    await getAdminAssetFamily(family.id)
    await createAdminAssetFamily({
      key: "quadras",
      label: "Quadras",
      fields: [],
      sortOrder: 3,
      isActive: true,
    })
    await updateAdminAssetFamily(family.id, {
      label: "Quadras",
      fields: [],
      sortOrder: 4,
      isActive: false,
    })
    await deleteAdminAssetFamily(family.id)

    expect(apiGet).toHaveBeenCalledWith(`/api/admin/asset-families/${family.id}`)
    expect(apiPost).toHaveBeenCalledWith("/api/admin/asset-families", {
      key: "quadras",
      label: "Quadras",
      fields: [],
      sortOrder: 3,
      isActive: true,
    })
    expect(apiPut).toHaveBeenCalledWith(`/api/admin/asset-families/${family.id}`, {
      label: "Quadras",
      fields: [],
      sortOrder: 4,
      isActive: false,
    })
    expect(apiDelete).toHaveBeenCalledWith(`/api/admin/asset-families/${family.id}`)
  })

  it("surfaces the API error string and a 403 fallback", async () => {
    apiDelete.mockRejectedValue({
      isAxiosError: true,
      payload: { error: "Asset family is in use and cannot be deleted." },
    })
    const { deleteAdminAssetFamily, listAdminAssetFamilies } = await import(
      "@/features/admin/services/adminAssetFamiliesService"
    )

    await expect(deleteAdminAssetFamily(family.id)).rejects.toThrow(
      "Asset family is in use and cannot be deleted.",
    )

    apiGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
      payload: null,
    })

    await expect(listAdminAssetFamilies()).rejects.toThrow(
      i18n.t("admin.errors.forbidden"),
    )
  })
})
