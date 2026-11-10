import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { CatalogForbiddenError, listCatalogOrders, listCatalogProducts, listCustomerGroups } from "@/features/catalog/services/catalogService"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { get: vi.fn() },
}))

function forbidden(): AxiosError {
  return new AxiosError("Forbidden", undefined, undefined, undefined, {
    status: 403,
    statusText: "Forbidden",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
    data: { error: "FORBIDDEN" },
  })
}

describe("catalog list 403", () => {
  it.each([
    ["orders", () => listCatalogOrders()],
    ["products", () => listCatalogProducts()],
    ["groups", () => listCustomerGroups()],
  ])("throws CatalogForbiddenError for %s", async (_label, load) => {
    vi.mocked(api.get).mockRejectedValue(forbidden())
    await expect(load()).rejects.toBeInstanceOf(CatalogForbiddenError)
  })
})
