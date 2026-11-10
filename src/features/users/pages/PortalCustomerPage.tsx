import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getCatalogProductAccess,
  listCatalogOrders,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import type { CatalogOrder, CustomerGroup } from "@/features/catalog/schemas/catalogSchemas"
import { exclusiveProductsForCustomer, type ExclusiveProduct } from "@/features/users/lib/exclusiveProducts"
import type { TenantCustomer } from "@/features/users/schemas/userSchemas"
import { listTenantCustomers } from "@/features/users/services/usersService"

const CUSTOMER_DIRECTORY_PAGE_SIZE = 50

async function findTenantCustomer(id: string): Promise<TenantCustomer | null> {
  let page = 1
  let covered = 0
  while (page <= 100) {
    const directory = await listTenantCustomers({ page, pageSize: CUSTOMER_DIRECTORY_PAGE_SIZE })
    const found = directory.items.find((item) => item.id === id)
    if (found) {
      return found
    }
    covered += directory.items.length
    if (directory.items.length < CUSTOMER_DIRECTORY_PAGE_SIZE || covered >= directory.total) {
      return null
    }
    page += 1
  }
  return null
}

export function PortalCustomerPage() {
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const [customer, setCustomer] = useState<TenantCustomer | null>(null)
  const [orders, setOrders] = useState<CatalogOrder[]>([])
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [products, setProducts] = useState<ExclusiveProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [found, orderList, groupList, productList] = await Promise.all([
          findTenantCustomer(id),
          listCatalogOrders({ customerId: id }),
          listCustomerGroups(),
          listCatalogProducts(),
        ])
        const memberGroups = groupList.filter((group) => group.memberCustomerIds.includes(id))
        const restricted = productList.filter((product) => product.visibility === "Restricted")
        const accessEntries = await Promise.all(restricted.map(async (product) => {
          try {
            const access = await getCatalogProductAccess(product.id)
            return [product.id, access] as const
          } catch {
            return [product.id, null] as const
          }
        }))
        const exclusive = exclusiveProductsForCustomer({
          customerId: id,
          groupIds: memberGroups.map((group) => group.id),
          products: productList,
          accessByProductId: Object.fromEntries(accessEntries),
        })
        if (!cancelled) {
          setCustomer(found)
          setOrders(orderList)
          setGroups(memberGroups)
          setProducts(exclusive)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("peopleAccess.errors.loadCustomers"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (loading) {
    return <PageContentSkeleton rows={4} />
  }

  const name = customer?.name ?? orders[0]?.customerName ?? t("peopleAccess.customerPage.notFound")

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 pb-8">
      <Link className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline" to="/pessoas-e-acesso?tab=customers">
        {t("peopleAccess.tabs.customers")}
      </Link>
      {error ? (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ) : (
      <>
      <PageHeader title={name} description={customer?.email ?? undefined} />
      <section className="space-y-2" aria-labelledby="customer-orders">
        <h2 id="customer-orders" className="text-lg font-semibold">{t("peopleAccess.customerPage.orders")}</h2>
        {orders.length === 0 ? <p className="text-sm text-muted-foreground">{t("peopleAccess.customerPage.noOrders")}</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {orders.map((order) => (
              <li key={order.id}>
                <Link className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm" to={`/catalogo/pedidos/${order.id}`}>
                  <span>{order.displayNumber}</span>
                  <span className="text-muted-foreground">{t(`catalog.status.${order.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2" aria-labelledby="customer-groups">
        <h2 id="customer-groups" className="text-lg font-semibold">{t("peopleAccess.customerPage.groups")}</h2>
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">{t("peopleAccess.customerPage.noGroups")}</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {groups.map((group) => (
              <li key={group.id}>
                <Link className="flex min-h-11 items-center px-3 text-sm" to={`/catalogo/grupos/${group.id}`}>
                  {group.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2" aria-labelledby="customer-products">
        <h2 id="customer-products" className="text-lg font-semibold">{t("peopleAccess.customerPage.products")}</h2>
        {products.length === 0 ? <p className="text-sm text-muted-foreground">{t("peopleAccess.customerPage.noProducts")}</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {products.map((product) => (
              <li key={product.id}>
                <Link className="flex min-h-11 items-center px-3 text-sm" to={`/catalogo/produtos/${product.id}`}>
                  {product.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}
    </div>
  )
}
