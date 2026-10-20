import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useOutletContext, useSearchParams } from "react-router-dom"
import { ShoppingBag } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { CatalogQuantityField } from "@/features/catalog/components/CatalogQuantityField"
import { PortalCatalogProductCard } from "@/features/catalog/components/PortalCatalogProductCard"
import {
  formatCartTotalText,
  formatLineSubtotal,
} from "@/features/catalog/lib/catalogPriceSummary"
import type { PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import { getPortalCatalogProduct, listPortalCatalogProducts } from "@/features/catalog/services/catalogPortalService"
import { useCatalogCart } from "@/features/catalog/useCatalogCart"
import { TaxonomyFilters } from "@/features/taxonomy/components/TaxonomyFilters"
import { taxonomyQueryFromSearch, setTaxonomySearchParams } from "@/features/taxonomy/lib/taxonomyQuery"
import type { TaxonomyOptions } from "@/features/taxonomy/schemas/taxonomySchemas"
import { getPortalCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"
import {
  getCustomerId,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"

type CartProductResolution = "loading" | "error"

export function PortalCatalogPage() {
  const { t } = useTranslation()
  const { subdomain, primary } = useOutletContext<CustomerAppOutletContext>()
  const customerId = getCustomerId()
  const cart = useCatalogCart(subdomain, customerId)
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get("category")
  const tagsParam = searchParams.get("tags")
  const taxonomyQuery = useMemo(
    () => taxonomyQueryFromSearch(new URLSearchParams({
      ...(categoryParam == null ? {} : { category: categoryParam }),
      ...(tagsParam == null ? {} : { tags: tagsParam }),
    })),
    [categoryParam, tagsParam],
  )
  const search = searchParams.get("search") ?? ""
  const portalIdentity = `${subdomain}:${customerId ?? ""}`

  const [products, setProducts] = useState<PortalProduct[]>([])
  const [cartProducts, setCartProducts] = useState<PortalProduct[]>([])
  const [cartProductResolutions, setCartProductResolutions] = useState<Record<string, CartProductResolution>>({})
  const [cartResolutionRevision, setCartResolutionRevision] = useState(0)
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyOptions>({ categories: [], tags: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [searchDraft, setSearchDraft] = useState(search)
  const generationRef = useRef(0)
  const portalIdentityRef = useRef(portalIdentity)
  const productsRef = useRef<PortalProduct[]>([])
  const cartProductsRef = useRef<PortalProduct[]>([])
  const cartProductResolutionsRef = useRef<Record<string, CartProductResolution>>({})
  const cartDetailControllersRef = useRef(new Set<AbortController>())

  useEffect(() => {
    portalIdentityRef.current = portalIdentity
  }, [portalIdentity])

  useEffect(() => {
    productsRef.current = products
  }, [products])

  const updateQuery = useCallback((next: { search?: string; categoryId?: string | null; tagIds?: string[] }) => {
    setSearchParams((current) => {
      const params = setTaxonomySearchParams(current, {
        category: next.categoryId === undefined ? taxonomyQuery.category : next.categoryId,
        tags: next.tagIds === undefined ? taxonomyQuery.tags : next.tagIds,
      })
      const nextSearch = next.search ?? search
      if (nextSearch) params.set("search", nextSearch)
      else params.delete("search")
      return params
    })
  }, [search, setSearchParams, taxonomyQuery.category, taxonomyQuery.tags])

  const load = useCallback(async (signal?: AbortSignal) => {
      const generation = ++generationRef.current
      setLoading(true)
      try {
        const data = taxonomyQuery.category || taxonomyQuery.tags?.length
          ? await listPortalCatalogProducts({ search, category: taxonomyQuery.category, tags: taxonomyQuery.tags }, { signal })
          : await listPortalCatalogProducts(search)
        if (generation !== generationRef.current || portalIdentityRef.current !== portalIdentity) return
        setProducts(data)
        setLoadError(null)
      } catch (error) {
        if (signal?.aborted || generation !== generationRef.current || portalIdentityRef.current !== portalIdentity) return
        setLoadError(
          error instanceof Error
            ? error.message
            : t("apiErrors.loadPortalCatalog"),
        )
      } finally {
        if (generation === generationRef.current && portalIdentityRef.current === portalIdentity) setLoading(false)
      }
  }, [portalIdentity, search, t, taxonomyQuery.category, taxonomyQuery.tags])

  useEffect(() => {
    generationRef.current += 1
    for (const controller of cartDetailControllersRef.current) {
      controller.abort()
    }
    cartDetailControllersRef.current.clear()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- identity-scoped data must disappear before the next portal request resolves
    setProducts([])
    setCartProducts([])
    setCartProductResolutions({})
    cartProductsRef.current = []
    cartProductResolutionsRef.current = {}
    setCartResolutionRevision(0)
    setQuantities({})
    setLoadError(null)
    setLoading(true)
  }, [portalIdentity])

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- request lifecycle owns loading state
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear tenant-scoped options before the replacement response
    setTaxonomyOptions({ categories: [], tags: [] })
    void getPortalCatalogTaxonomyOptions(controller.signal).then((options) => {
      if (!controller.signal.aborted) setTaxonomyOptions(options)
    }).catch(() => { if (!controller.signal.aborted) setTaxonomyOptions({ categories: [], tags: [] }) })
    return () => controller.abort()
  }, [portalIdentity])

  useEffect(() => {
    const cartIds = new Set(cart.items.map((item) => item.productId))
    const visibleCartProducts = products.filter((product) => cartIds.has(product.id))
    if (visibleCartProducts.length === 0) {
      return
    }
    setCartProducts((current) => {
      const next = mergeProducts(current, visibleCartProducts)
      cartProductsRef.current = next
      return next
    })
  }, [cart.items, products])

  useEffect(() => {
    const visible = new Set(productsRef.current.map((product) => product.id))
    const cached = new Set(cartProductsRef.current.map((product) => product.id))
    const missing = cart.items
      .map((item) => item.productId)
      .filter((id) => !visible.has(id) && !cached.has(id) && cartProductResolutionsRef.current[id] == null)
    if (missing.length === 0) {
      return
    }

    const controller = new AbortController()
    const requestIdentity = portalIdentity
    cartDetailControllersRef.current.add(controller)
    setCartProductResolutions((current) => {
      const next = Object.fromEntries([
        ...Object.entries(current),
        ...missing.map((id) => [id, "loading"] as const),
      ])
      cartProductResolutionsRef.current = next
      return next
    })
    void Promise.all(missing.map(async (id) => {
      try {
        return { id, product: await getPortalCatalogProduct(id, { signal: controller.signal }) }
      } catch {
        return { id, product: null }
      }
    })).then((details) => {
      if (controller.signal.aborted || portalIdentityRef.current !== requestIdentity) {
        return
      }
      const resolved = details.flatMap((detail) => detail.product ? [detail.product] : [])
      setCartProducts((current) => {
        const next = mergeProducts(current, resolved)
        cartProductsRef.current = next
        return next
      })
      setCartProductResolutions((current) => {
        const next = { ...current }
        for (const detail of details) {
          if (detail.product) delete next[detail.id]
          else next[detail.id] = "error"
        }
        cartProductResolutionsRef.current = next
        return next
      })
    }).finally(() => {
      cartDetailControllersRef.current.delete(controller)
    })
  }, [cart.items, cartResolutionRevision, portalIdentity])

  const retryCartProduct = useCallback((productId: string) => {
    setCartProductResolutions((current) => {
      const next = { ...current }
      delete next[productId]
      cartProductResolutionsRef.current = next
      return next
    })
    setCartResolutionRevision((current) => current + 1)
  }, [])

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateQuery({ search: value })
  }, 300)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect browser navigation in the editable search draft
    setSearchDraft(search)
  }, [search])

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("tenantPortal.catalog.title")}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              render={
                <Link to={tenantPortalPath(subdomain, "catalogo/solicitar")} />
              }
            >
              {t("tenantPortal.catalog.requestCta")}
            </Button>
            <Button
              type="button"
              variant="outline"
              render={
                <Link to={tenantPortalPath(subdomain, "catalogo/solicitacoes")} />
              }
            >
              {t("tenantPortal.catalog.navRequests")}
            </Button>
            <Button
              type="button"
              variant="outline"
              render={<Link to={tenantPortalPath(subdomain, "catalogo/carrinho")} />}
            >
              <ShoppingBag data-icon="inline-start" />
              {t("tenantPortal.catalog.cartCount", { count: cart.totalQuantity })}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.subtitle")}
        </p>
        <Input
          value={searchDraft}
          placeholder={t("tenantPortal.catalog.searchPlaceholder")}
          onChange={(event) => {
            const value = event.target.value
            setSearchDraft(value)
            debouncedSearch(value)
          }}
        />
        <TaxonomyFilters
          options={taxonomyOptions}
          categoryId={taxonomyQuery.category ?? null}
          tagIds={taxonomyQuery.tags ?? []}
          disabled={loading}
          onChange={({ categoryId, tagIds }) => updateQuery({ categoryId, tagIds })}
        />
      </header>

      {loadError ? (
        <div className="flex items-center gap-2 text-sm text-destructive"><p>{loadError}</p><Button type="button" variant="outline" size="sm" onClick={() => void load()}>{t("catalog.retry")}</Button></div>
      ) : null}

      {loading ? (
        <PageContentSkeleton rows={4} />
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim()
            ? t("tenantPortal.catalog.searchEmpty", { term: search.trim() })
            : t("tenantPortal.catalog.empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const qty = quantities[product.id] ?? 1
            return (
              <li key={product.id} className="min-h-0">
                <PortalCatalogProductCard
                  product={product}
                  subdomain={subdomain}
                  quantity={qty}
                  onQuantityChange={(next) => {
                    setQuantities((current) => ({
                      ...current,
                      [product.id]: next,
                    }))
                  }}
                  onAdd={() => {
                    cart.add(product.id, qty)
                    toast.success(t("tenantPortal.catalog.addedToCart"))
                  }}
                  primary={primary}
                />
              </li>
            )
          })}
        </ul>
      )}

      {cart.items.length > 0 ? (
        <PortalCartPanel
          subdomain={subdomain}
          products={mergeProducts(cartProducts, products)}
          resolutions={cartProductResolutions}
          onRetryProduct={retryCartProduct}
          cart={cart}
        />
      ) : null}
    </div>
  )
}

function mergeProducts(current: PortalProduct[], additions: PortalProduct[]): PortalProduct[] {
  const byId = new Map(current.map((product) => [product.id, product]))
  for (const product of additions) {
    byId.set(product.id, product)
  }
  return [...byId.values()]
}

function PortalCartPanel({
  subdomain,
  products,
  resolutions,
  onRetryProduct,
  cart,
}: {
  subdomain: string
  products: PortalProduct[]
  resolutions: Record<string, CartProductResolution>
  onRetryProduct: (productId: string) => void
  cart: ReturnType<typeof useCatalogCart>
}) {
  const { t, i18n } = useTranslation()
  const productMap = new Map(products.map((product) => [product.id, product]))
  const onRequestLabel = t("tenantPortal.catalog.priceOnRequest")
  const hasUnresolvedProduct = cart.items.some((item) => !productMap.has(item.productId))
  const cartTotalLabel = hasUnresolvedProduct
    ? t("tenantPortal.catalog.cartTotalUnavailable")
    : formatCartTotalText(
    cart.items.map((item) => {
      const product = productMap.get(item.productId)
      return {
        price: product?.price ?? null,
        currency: product?.currency ?? "",
        quantity: item.quantity,
      }
    }),
    i18n.language,
    {
      onRequest: onRequestLabel,
      partial: (amount) => t("tenantPortal.catalog.fromAmount", { amount }),
    },
  )

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <h2 className="text-sm font-medium">{t("tenantPortal.catalog.cartTitle")}</h2>
      <ul className="space-y-2 text-sm">
        {cart.items.map((item) => {
          const product = productMap.get(item.productId)
          const resolution = resolutions[item.productId]
          const name = product?.name ?? item.productId.slice(0, 8)
          return (
            <li key={item.productId} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate">{name}</p>
                {product ? (
                  <p className="text-muted-foreground">
                    {t("tenantPortal.catalog.lineSubtotal")}:{" "}
                    {formatLineSubtotal(
                      product.price,
                      product.currency,
                      item.quantity,
                      i18n.language,
                      onRequestLabel,
                    )}
                  </p>
                ) : resolution === "error" ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <p>{t("tenantPortal.catalog.cartProductUnavailable")}</p>
                    <Button type="button" variant="link" size="sm" onClick={() => onRetryProduct(item.productId)}>
                      {t("catalog.retry")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t("tenantPortal.catalog.cartProductLoading")}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <CatalogQuantityField
                  className="w-16"
                  quantity={item.quantity}
                  productName={name}
                  onCommit={(next) => {
                    cart.update(item.productId, next)
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    cart.remove(item.productId)
                  }}
                >
                  {t("tenantPortal.catalog.removeItem", { name })}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-sm font-medium">
        {t("tenantPortal.catalog.cartTotal")}: {cartTotalLabel}
      </p>
      <Button
        type="button"
        className="w-full"
        render={<Link to={tenantPortalPath(subdomain, "catalogo/carrinho")} />}
      >
        {t("tenantPortal.catalog.checkout")}
      </Button>
    </section>
  )
}
