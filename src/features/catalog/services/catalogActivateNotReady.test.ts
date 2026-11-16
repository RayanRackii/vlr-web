import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { describe, expect, it, vi } from "vitest"

import { activateCatalogProduct } from "@/features/catalog/services/catalogService"
import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { post: vi.fn() },
}))

function notReady(missing: string[]): AxiosError {
  return new AxiosError("Conflict", undefined, undefined, undefined, {
    status: 409,
    statusText: "Conflict",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
    data: { error: "Product is not ready for sale.", code: "PRODUCT_NOT_READY", missing },
  })
}

describe("activateCatalogProduct 409 PRODUCT_NOT_READY", () => {
  it("throws a pt-BR message listing the missing items", async () => {
    vi.mocked(api.post).mockRejectedValue(notReady(["RESOURCE", "PRICE"]))
    await expect(activateCatalogProduct("p1")).rejects.toThrow(
      "Não dá para ativar: falta um recurso na agenda, preço maior que zero.",
    )
  })
})
