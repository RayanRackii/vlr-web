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

  it("translates a customer-visible file type error", () => {
    expect(
      localizeCatalogApiError(
        { error: "Customer-visible files must be jpeg, png, or webp." },
        "fallback",
      ),
    ).toBe(i18n.t("catalog.products.files.typeCustomer"))
  })
})
