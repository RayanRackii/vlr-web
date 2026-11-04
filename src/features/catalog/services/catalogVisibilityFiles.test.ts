import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"
import { putCatalogProductAccess } from "./catalogService"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  api: { put: vi.fn() },
}))

describe("visibility file conflict", () => {
  it.each(["pt-BR", "en", "es"])("localizes the save 409 in %s", async (lng) => {
    const previousLanguage = i18n.language
    await i18n.changeLanguage(lng)
    try {
      vi.mocked(api.put).mockRejectedValue(new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409, statusText: "Conflict", headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
        data: { code: "catalog.visibility.filesPresent", error: "Remove or re-upload files before changing visibility." },
      }))
      const message = i18n.t("catalog.products.access.filesPresent")
      expect(message).not.toBe("catalog.products.access.filesPresent")
      await expect(putCatalogProductAccess("p1", { visibility: "Restricted", customerIds: [], groupIds: [] })).rejects.toThrow(message)
    } finally {
      await i18n.changeLanguage(previousLanguage)
    }
  })
})
