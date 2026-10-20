import { beforeEach, describe, expect, it, vi } from "vitest"

import { customerApi } from "@/lib/api"
import { listPortalCatalogProducts } from "@/features/catalog/services/catalogPortalService"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, customerApi: { get: vi.fn() } }
})

const customerGet = vi.mocked(customerApi.get)

describe("listPortalCatalogProducts search", () => {
  beforeEach(() => {
    customerGet.mockReset()
    customerGet.mockResolvedValue({ data: [] })
  })

  it.each(["impre", "dobradica", "IMPRESSORA", "DObradiça", "  Dobradiça  "])(
    "preserves case and accents in the API search parameter: %s",
    async (term) => {
      await listPortalCatalogProducts(term)
      expect(customerGet).toHaveBeenCalledWith("/api/catalog/portal/products", {
        params: { search: term.trim() },
      })
    },
  )

  it.each([undefined, "", "   "])("omits an empty search parameter: %s", async (term) => {
    await listPortalCatalogProducts(term)
    expect(customerGet).toHaveBeenCalledWith("/api/catalog/portal/products", {
      params: undefined,
    })
  })
})
