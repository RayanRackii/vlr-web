import { useCallback, useEffect, useMemo, useState } from "react"

import {
  addCartItem,
  catalogCartStorageKey,
  clearCatalogCart,
  loadCatalogCart,
  removeCartItem,
  saveCatalogCart,
  updateCartItem,
  type CatalogCartItem,
} from "@/features/catalog/cart"

export function useCatalogCart(tenantSubdomain: string, customerId: string | null) {
  const storageKey = useMemo(() => {
    if (!customerId) {
      return null
    }
    return catalogCartStorageKey(tenantSubdomain, customerId)
  }, [customerId, tenantSubdomain])

  const [items, setItems] = useState<CatalogCartItem[]>([])

  useEffect(() => {
    if (!storageKey) {
      setItems([])
      return
    }
    setItems(loadCatalogCart(window.sessionStorage, storageKey))
  }, [storageKey])

  const persist = useCallback(
    (next: CatalogCartItem[]) => {
      setItems(next)
      if (storageKey) {
        saveCatalogCart(window.sessionStorage, storageKey, next)
      }
    },
    [storageKey],
  )

  const add = useCallback(
    (productId: string, quantity: number) => {
      persist(addCartItem(items, productId, quantity))
    },
    [items, persist],
  )

  const update = useCallback(
    (productId: string, quantity: number) => {
      persist(updateCartItem(items, productId, quantity))
    },
    [items, persist],
  )

  const remove = useCallback(
    (productId: string) => {
      persist(removeCartItem(items, productId))
    },
    [items, persist],
  )

  const clear = useCallback(() => {
    persist([])
    if (storageKey) {
      clearCatalogCart(window.sessionStorage, storageKey)
    }
  }, [persist, storageKey])

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

  return { items, add, update, remove, clear, totalQuantity, storageKey }
}
