import { useEffect, useMemo, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { ShoppingBag } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  CATALOG_CART_MAX_QUANTITY,
  CATALOG_CART_MIN_QUANTITY,
} from "@/features/catalog/cart"
import { PortalCatalogProductCard } from "@/features/catalog/components/PortalCatalogProductCard"
import {
  formatCartTotalText,
  formatLineSubtotal,
} from "@/features/catalog/lib/catalogPriceSummary"
import type { PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import { listPortalCatalogProducts } from "@/features/catalog/services/catalogPortalService"
import { useCatalogCart } from "@/features/catalog/useCatalogCart"
import {
  getCustomerId,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"

export function PortalCatalogPage() {
  const { t } = useTranslation()
  const { subdomain, primary } = useOutletContext<CustomerAppOutletContext>()
  const customerId = getCustomerId()
  const cart = useCatalogCart(subdomain, customerId)

  const [products, setProducts] = useState<PortalProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const load = useMemo(
    () => async (term: string) => {
      setLoading(true)
      try {
        const data = await listPortalCatalogProducts(term)
        setProducts(data)
        setLoadError(null)
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : t("apiErrors.loadPortalCatalog"),
        )
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load("")
  }, [load])

  const debouncedSearch = useDebouncedCallback((value: string) => {
    void load(value)
  }, 300)

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
          value={search}
          placeholder={t("tenantPortal.catalog.searchPlaceholder")}
          onChange={(event) => {
            const value = event.target.value
            setSearch(value)
            debouncedSearch(value)
          }}
        />
      </header>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      {loading ? (
        <PageContentSkeleton rows={4} />
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.empty")}
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
        <PortalCartPanel subdomain={subdomain} products={products} cart={cart} />
      ) : null}
    </div>
  )
}

function PortalCartPanel({
  subdomain,
  products,
  cart,
}: {
  subdomain: string
  products: PortalProduct[]
  cart: ReturnType<typeof useCatalogCart>
}) {
  const { t, i18n } = useTranslation()
  const productMap = new Map(products.map((product) => [product.id, product]))
  const onRequestLabel = t("tenantPortal.catalog.priceOnRequest")
  const cartTotalLabel = formatCartTotalText(
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
          const name = product?.name ?? item.productId.slice(0, 8)
          return (
            <li key={item.productId} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate">{name}</p>
                <p className="text-muted-foreground">
                  {t("tenantPortal.catalog.lineSubtotal")}:{" "}
                  {formatLineSubtotal(
                    product?.price ?? null,
                    product?.currency ?? "",
                    item.quantity,
                    i18n.language,
                    onRequestLabel,
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={CATALOG_CART_MIN_QUANTITY}
                  max={CATALOG_CART_MAX_QUANTITY}
                  className="w-16"
                  value={item.quantity}
                  aria-label={t("tenantPortal.catalog.quantity")}
                  onChange={(event) => {
                    cart.update(item.productId, Number(event.target.value))
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
