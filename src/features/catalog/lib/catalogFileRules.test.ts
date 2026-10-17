import { describe, expect, it } from "vitest"

import { catalogFileRejection } from "@/features/catalog/lib/catalogFileRules"

function file(name: string, size: number): Pick<File, "name" | "size"> {
  return { name, size }
}

describe("catalogFileRejection", () => {
  it("rejects a customer-visible file over 5 MB", () => {
    expect(
      catalogFileRejection(file("photo.jpg", 5 * 1024 * 1024 + 1), "CustomerVisible"),
    ).toBe("tooLargeCustomer")
  })

  it("rejects a customer-visible file that is not an image", () => {
    expect(catalogFileRejection(file("notes.pdf", 100), "CustomerVisible")).toBe(
      "typeCustomer",
    )
  })

  it("accepts a png within the customer limit", () => {
    expect(catalogFileRejection(file("photo.png", 1024), "CustomerVisible")).toBeNull()
  })
})
