export type CatalogCartItem = {
  productId: string
  quantity: number
}

export function catalogCartStorageKey(
  tenantSubdomain: string,
  customerId: string,
): string {
  return `rolvix.catalog.cart.${tenantSubdomain.trim().toLowerCase()}.${customerId}`
}

export function addCartItem(
  items: readonly CatalogCartItem[],
  productId: string,
  quantity: number,
): CatalogCartItem[] {
  const nextQuantity = Math.trunc(quantity)
  if (nextQuantity <= 0) {
    return items.map((item) => ({ ...item }))
  }

  const existing = items.find((item) => item.productId === productId)
  if (!existing) {
    return [...items, { productId, quantity: nextQuantity }]
  }

  return items.map((item) =>
    item.productId === productId
      ? { ...item, quantity: item.quantity + nextQuantity }
      : { ...item },
  )
}

export function updateCartItem(
  items: readonly CatalogCartItem[],
  productId: string,
  quantity: number,
): CatalogCartItem[] {
  const nextQuantity = Math.trunc(quantity)
  if (nextQuantity <= 0) {
    return removeCartItem(items, productId)
  }

  let found = false
  const next = items.map((item) => {
    if (item.productId !== productId) {
      return { ...item }
    }
    found = true
    return { ...item, quantity: nextQuantity }
  })

  if (!found) {
    return [...next, { productId, quantity: nextQuantity }]
  }

  return next
}

export function removeCartItem(
  items: readonly CatalogCartItem[],
  productId: string,
): CatalogCartItem[] {
  return items.filter((item) => item.productId !== productId)
}

const cartItemsSchema = {
  parse(value: unknown): CatalogCartItem[] {
    if (!Array.isArray(value)) {
      return []
    }

    const items: CatalogCartItem[] = []
    for (const entry of value) {
      if (typeof entry !== "object" || entry === null) {
        continue
      }
      const record = entry as Record<string, unknown>
      const productId =
        typeof record.productId === "string" ? record.productId : null
      const quantity =
        typeof record.quantity === "number" && Number.isFinite(record.quantity)
          ? Math.trunc(record.quantity)
          : null
      if (productId && quantity && quantity > 0) {
        items.push({ productId, quantity })
      }
    }
    return items
  },
}

export function loadCatalogCart(
  storage: Pick<Storage, "getItem">,
  key: string,
): CatalogCartItem[] {
  const raw = storage.getItem(key)
  if (raw == null || raw.trim().length === 0) {
    return []
  }

  try {
    return cartItemsSchema.parse(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function saveCatalogCart(
  storage: Pick<Storage, "setItem">,
  key: string,
  items: readonly CatalogCartItem[],
): void {
  storage.setItem(key, JSON.stringify(items))
}

export function clearCatalogCart(
  storage: Pick<Storage, "removeItem">,
  key: string,
): void {
  storage.removeItem(key)
}
