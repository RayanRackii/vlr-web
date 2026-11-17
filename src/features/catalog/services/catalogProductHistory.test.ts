import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { catalogProductSchema } from "@/features/catalog/schemas/catalogSchemas"
import {
  deleteCatalogProduct,
  duplicateCatalogProduct,
  getCatalogProductHistory,
} from "@/features/catalog/services/catalogService"
import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const PRODUCT = {
  id: ID, name: "Copia", code: "X-COPIA", description: null, price: 1, currency: "BRL", isActive: false,
  createdAt: "2026-11-12T00:00:00Z", files: [],
}

beforeEach(() => vi.clearAllMocks())

describe("getCatalogProductHistory", () => {
  it("sends the limit and the before + beforeId cursor and parses null actors and changes", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: ID, action: "product.updated", changes: [{ field: "price", old: "40.00", new: "45.00" }], actorName: null, createdAt: "2026-11-12T17:30:00Z" },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", action: "product.created", changes: null, actorName: "Ana", createdAt: "2026-11-11T17:30:00Z" }],
    })
    const entries = await getCatalogProductHistory(ID, { limit: 20, cursor: { before: "2026-11-12T17:30:00Z", beforeId: ID } })
    expect(api.get).toHaveBeenCalledWith(`/api/catalog/products/${ID}/history`, {
      params: { limit: 20, before: "2026-11-12T17:30:00Z", beforeId: ID },
    })
    expect(entries[0]).toMatchObject({ actorName: null, changes: [{ field: "price", old: "40.00", new: "45.00" }] })
    expect(entries[1]).toMatchObject({ actorName: "Ana", changes: [] })
  })

  it("omits the cursor on the first page", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await getCatalogProductHistory(ID)
    expect(api.get).toHaveBeenCalledWith(`/api/catalog/products/${ID}/history`, { params: { limit: 50 } })
  })
})

describe("duplicateCatalogProduct", () => {
  it("posts to the duplicate endpoint and returns the inactive copy", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: PRODUCT })
    const copy = await duplicateCatalogProduct(ID)
    expect(api.post).toHaveBeenCalledWith(`/api/catalog/products/${ID}/duplicate`)
    expect(copy.isActive).toBe(false)
  })
})

describe("deleteCatalogProduct", () => {
  it("deletes the product", async () => {
    vi.mocked(api.delete).mockResolvedValue({ status: 204 })
    await deleteCatalogProduct(ID)
    expect(api.delete).toHaveBeenCalledWith(`/api/catalog/products/${ID}`)
  })

  it("maps 409 PRODUCT_HAS_ORDERS to the deactivate suggestion", async () => {
    vi.mocked(api.delete).mockRejectedValue(new AxiosError("Conflict", undefined, undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: {} } as InternalAxiosRequestConfig,
      data: { error: "Product has orders.", code: "PRODUCT_HAS_ORDERS" },
    }))
    await expect(deleteCatalogProduct(ID)).rejects.toThrow("Este produto tem pedidos; desative-o em vez de excluir.")
  })
})

describe("catalogProductSchema updatedAt", () => {
  it("accepts a product with or without updatedAt", () => {
    expect(catalogProductSchema.safeParse(PRODUCT).success).toBe(true)
    expect(catalogProductSchema.parse({ ...PRODUCT, updatedAt: "2026-11-13T00:00:00Z" }).updatedAt).toBe("2026-11-13T00:00:00Z")
    expect(catalogProductSchema.parse({ ...PRODUCT, updatedAt: null }).updatedAt).toBeNull()
  })
})
