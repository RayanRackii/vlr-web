import { describe, expect, it } from "vitest"

import { catalogProductSaveBlockerKeys } from "@/features/catalog/lib/catalogProductSaveBlockers"

describe("catalogProductSaveBlockerKeys", () => {
  it("explains an empty name and a currency that is not 3 letters", () => {
    expect(
      catalogProductSaveBlockerKeys({
        name: " ",
        code: "",
        description: "",
        price: "",
        currency: "BR",
      }),
    ).toEqual([
      "catalog.products.validation.nameRequired",
      "catalog.products.validation.currency",
    ])
  })

  it("returns nothing when the product form is valid", () => {
    expect(
      catalogProductSaveBlockerKeys({
        name: "Raquete",
        code: "RAQ",
        description: "",
        price: "",
        currency: "BRL",
      }),
    ).toEqual([])
  })
})
