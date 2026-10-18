export const CATALOG_CART_MIN_QUANTITY = 1
export const CATALOG_CART_MAX_QUANTITY = 99

export type CatalogCartItem = {
  productId: string
  quantity: number
}

/** Keeps a cart line. Zero and negative quantities become 1; they do not remove it. */
export function clampCatalogQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return CATALOG_CART_MIN_QUANTITY
  }

  const truncated = Math.trunc(quantity)
  if (truncated < CATALOG_CART_MIN_QUANTITY) {
    return CATALOG_CART_MIN_QUANTITY
  }
  if (truncated > CATALOG_CART_MAX_QUANTITY) {
    return CATALOG_CART_MAX_QUANTITY
  }
  return truncated
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
  if (!Number.isFinite(quantity)) {
    return items.map((item) => ({ ...item }))
  }

  const nextQuantity = Math.trunc(quantity)
  if (nextQuantity <= 0) {
    return items.map((item) => ({ ...item }))
  }

  const addition = Math.min(nextQuantity, CATALOG_CART_MAX_QUANTITY)
  const existing = items.find((item) => item.productId === productId)
  if (!existing) {
    return [...items, { productId, quantity: addition }]
  }

  return items.map((item) =>
    item.productId === productId
      ? {
          ...item,
          quantity: Math.min(
            item.quantity + addition,
            CATALOG_CART_MAX_QUANTITY,
          ),
        }
      : { ...item },
  )
}

export function updateCartItem(
  items: readonly CatalogCartItem[],
  productId: string,
  quantity: number,
): CatalogCartItem[] {
  const nextQuantity = clampCatalogQuantity(quantity)

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
          ? clampCatalogQuantity(record.quantity)
          : null
      if (productId && quantity != null) {
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
