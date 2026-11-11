import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { CatalogOrder, ProductRequest } from "../schemas/catalogSchemas"
import { listCatalogOrders, listProductRequests } from "../services/catalogService"

export function usePedidos(requestsOnly = false) {
  const { t } = useTranslation()
  const { can, activeModules, currentUser, isLoading } = usePermissions()
  const catalog = !isLoading && activeModules.includes("catalog")
  const ordersAllowed = catalog && !requestsOnly && can("catalog.orders.read")
  const requestsAllowed = catalog && can("catalog.products.read")
  const scope = `${currentUser?.tenantId ?? ""}:${ordersAllowed}:${requestsAllowed}`
  const [revision, setRevision] = useState(0)
  const requestKey = `${scope}:${revision}`
  const [state, setState] = useState<{ scope: string; orders: CatalogOrder[]; requests: ProductRequest[]; errors: string[] }>({ scope: "", orders: [], requests: [], errors: [] })
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    void Promise.allSettled([
      ordersAllowed ? listCatalogOrders() : Promise.resolve([] as CatalogOrder[]),
      requestsAllowed ? listProductRequests({ signal: controller.signal }) : Promise.resolve([] as ProductRequest[]),
    ]).then(([orders, requests]) => {
      if (cancelled) return
      const errors: string[] = []
      if (orders.status === "rejected") errors.push(orders.reason instanceof Error ? orders.reason.message : t("apiErrors.loadCatalogOrders"))
      if (requests.status === "rejected") errors.push(requests.reason instanceof Error ? requests.reason.message : t("apiErrors.loadProductRequests"))
      setState({ scope: requestKey, orders: orders.status === "fulfilled" ? orders.value : [], requests: requests.status === "fulfilled" ? requests.value : [], errors })
    })
    return () => { cancelled = true; controller.abort() }
  }, [requestKey, ordersAllowed, requestsAllowed, t])
  return {
    orders: state.scope === requestKey && ordersAllowed ? state.orders : [],
    requests: state.scope === requestKey && requestsAllowed ? state.requests : [],
    errors: state.scope === requestKey ? state.errors : [],
    loading: isLoading || state.scope !== requestKey,
    ordersAllowed, requestsAllowed,
    retry: () => setRevision(value => value + 1),
  }
}
