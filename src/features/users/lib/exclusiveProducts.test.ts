import { describe, expect, it } from "vitest"

import { exclusiveProductsForCustomer } from "@/features/users/lib/exclusiveProducts"

describe("exclusiveProductsForCustomer", () => {
  it("keeps only restricted products granted to the person or their group", () => {
    const products = exclusiveProductsForCustomer({
      customerId: "customer-1",
      groupIds: ["group-1"],
      products: [
        { id: "public", name: "Suco", visibility: "Public" },
        { id: "direct", name: "Kit", visibility: "Restricted" },
        { id: "via-group", name: "Camisa", visibility: "Restricted" },
        { id: "other", name: "Outro", visibility: "Restricted" },
      ],
      accessByProductId: {
        direct: { customerIds: ["customer-1"], groupIds: [] },
        "via-group": { customerIds: [], groupIds: ["group-1"] },
        other: { customerIds: ["customer-2"], groupIds: ["group-2"] },
      },
    })
    expect(products.map((product) => product.name)).toEqual(["Kit", "Camisa"])
  })
})
