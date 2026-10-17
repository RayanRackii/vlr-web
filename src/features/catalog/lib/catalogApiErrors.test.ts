import { describe, expect, it } from "vitest"

import { localizeCatalogApiError } from "@/features/catalog/lib/catalogApiErrors"
import i18n from "@/lib/i18n"

describe("localizeCatalogApiError", () => {
  it("translates a duplicate product code", () => {
    expect(
      localizeCatalogApiError(
        { error: "A product with this code already exists." },
        "fallback",
      ),
    ).toBe(i18n.t("catalog.products.errors.duplicateCode"))
  })

  it("translates file codes from the API", () => {
    expect(
      localizeCatalogApiError(
        { error: "File is too large.", code: "FILE_TOO_LARGE" },
        "fallback",
      ),
    ).toBe(i18n.t("catalog.products.files.tooLarge"))
    expect(
      localizeCatalogApiError(
        { code: "FILE_TYPE_NOT_ALLOWED", error: "Type rejected." },
        "fallback",
      ),
    ).toBe(i18n.t("catalog.products.files.typeRejected"))
    expect(
      localizeCatalogApiError(
        { code: "FILE_CONTENT_MISMATCH", error: "Mismatch." },
        "fallback",
      ),
    ).toBe(i18n.t("catalog.products.files.contentMismatch"))
    expect(
      localizeCatalogApiError(
        { code: "CATALOG_FILE_TOO_LARGE", error: "An unexpected error occurred." },
        "fallback",
      ),
    ).toBe("fallback")
  })

  it("translates a customer-visible file type error", () => {
    expect(
      localizeCatalogApiError(
        { error: "Customer-visible files must be jpeg, png, or webp." },
        "fallback",
      ),
    ).toBe(i18n.t("catalog.products.files.typeCustomer"))
  })
})
