import { describe, expect, it } from "vitest"

import {
  addCartItem,
  catalogCartStorageKey,
  clearCatalogCart,
  loadCatalogCart,
  removeCartItem,
  saveCatalogCart,
  updateCartItem,
} from "@/features/catalog/cart"

describe("catalog cart helpers", () => {
  it("adds a new line and increments an existing product", () => {
    const first = addCartItem([], "p1", 2)
    expect(first).toEqual([{ productId: "p1", quantity: 2 }])

    const second = addCartItem(first, "p1", 3)
    expect(second).toEqual([{ productId: "p1", quantity: 5 }])

    const third = addCartItem(second, "p2", 1)
    expect(third).toEqual([
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 1 },
    ])
  })

  it("ignores non-positive add quantities", () => {
    const items = addCartItem([{ productId: "p1", quantity: 1 }], "p1", 0)
    expect(items).toEqual([{ productId: "p1", quantity: 1 }])
  })

  it("updates quantity and removes when quantity is zero", () => {
    const items = [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ]

    expect(updateCartItem(items, "p1", 4)).toEqual([
      { productId: "p1", quantity: 4 },
      { productId: "p2", quantity: 1 },
    ])
    expect(updateCartItem(items, "p1", 0)).toEqual([
      { productId: "p2", quantity: 1 },
    ])
  })

  it("removes a product by id", () => {
    const items = [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ]
    expect(removeCartItem(items, "p1")).toEqual([
      { productId: "p2", quantity: 1 },
    ])
    expect(removeCartItem(items, "missing")).toEqual(items)
  })

  it("keys session storage by tenant and customer", () => {
    expect(catalogCartStorageKey("acme-club", "cust-1")).toBe(
      "rolvix.catalog.cart.acme-club.cust-1",
    )
  })

  it("round-trips cart items through storage", () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    }

    const key = catalogCartStorageKey("club", "customer-id")
    saveCatalogCart(storage, key, [{ productId: "p1", quantity: 2 }])
    expect(loadCatalogCart(storage, key)).toEqual([
      { productId: "p1", quantity: 2 },
    ])
    clearCatalogCart(storage, key)
    expect(loadCatalogCart(storage, key)).toEqual([])
  })
})
