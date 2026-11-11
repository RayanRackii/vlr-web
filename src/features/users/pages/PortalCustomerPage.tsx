import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/layout/PageHeader"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CatalogForbiddenError,
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

type CatalogSections = {
  orders: boolean
  groups: boolean
  products: boolean
}

async function loadSection<T>(load: () => Promise<T>, fallback: T): Promise<{
  value: T
  denied: boolean
  failed: boolean
  message: string | null
}> {
  try {
    return { value: await load(), denied: false, failed: false, message: null }
  } catch (error) {
    if (error instanceof CatalogForbiddenError) {
      return { value: fallback, denied: true, failed: false, message: null }
    }
    return {
      value: fallback,
      denied: false,
      failed: true,
      message: error instanceof Error ? error.message : null,
    }
  }
}

export function PortalCustomerPage() {
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const [customer, setCustomer] = useState<TenantCustomer | null>(null)
  const [orders, setOrders] = useState<CatalogOrder[]>([])
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [products, setProducts] = useState<ExclusiveProduct[]>([])
  const [denied, setDenied] = useState<CatalogSections>({ orders: false, groups: false, products: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const found = await findTenantCustomer(id)
        const [orderResult, groupResult, productResult] = await Promise.all([
          loadSection(() => listCatalogOrders({ customerId: id }), [] as CatalogOrder[]),
          loadSection(() => listCustomerGroups(), [] as CustomerGroup[]),
          loadSection(() => listCatalogProducts(), []),
        ])
        const memberGroups = groupResult.value.filter((group) => group.memberCustomerIds.includes(id))
        const restricted = productResult.value.filter((product) => product.visibility === "Restricted")
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
          products: productResult.value,
          accessByProductId: Object.fromEntries(accessEntries),
        })
        if (!cancelled) {
          setCustomer(found)
          setOrders(orderResult.value)
          setGroups(memberGroups)
          setProducts(exclusive)
          setDenied({
            orders: orderResult.denied,
            groups: groupResult.denied,
            products: productResult.denied,
          })
          setError(
            [orderResult, groupResult, productResult].find((result) => result.failed)?.message
              ?? (orderResult.failed || groupResult.failed || productResult.failed
                ? t("peopleAccess.errors.loadCustomers")
                : null),
          )
        }
      } catch (loadError) {
        if (!cancelled) {
          setCustomer(null)
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
      {denied.orders || denied.groups || denied.products ? (
        <Alert>
          <AlertDescription>{t("peopleAccess.customerPage.catalogDenied")}</AlertDescription>
        </Alert>
      ) : null}
      {denied.orders ? null : (
      <section className="space-y-2" aria-labelledby="customer-orders">
        <h2 id="customer-orders" className="text-lg font-semibold">{t("peopleAccess.customerPage.orders")}</h2>
        {orders.length === 0 ? <p className="text-sm text-muted-foreground">{t("peopleAccess.customerPage.noOrders")}</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {orders.map((order) => (
              <li key={order.id}>
                <Link className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm" to={`/pedidos/${order.id}`}>
                  <span>{order.displayNumber}</span>
                  <span className="text-muted-foreground">{t(`catalog.status.${order.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
      {denied.groups ? null : (
      <section className="space-y-2" aria-labelledby="customer-groups">
        <h2 id="customer-groups" className="text-lg font-semibold">{t("peopleAccess.customerPage.groups")}</h2>
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">{t("peopleAccess.customerPage.noGroups")}</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {groups.map((group) => (
              <li key={group.id}>
                <Link className="flex min-h-11 items-center px-3 text-sm" to={`/grupos/${group.id}`}>
                  {group.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
      {denied.products || denied.groups ? null : (
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
      )}
      </>
      )}
    </div>
  )
}
