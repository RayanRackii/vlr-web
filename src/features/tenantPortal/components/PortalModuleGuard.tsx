import { Outlet, useOutletContext } from "react-router-dom"

import { isCustomerNavModule, toCanonicalModuleName } from "@/features/catalog/customerNav"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"

type PortalModuleGuardProps = {
  moduleName: string
}

/** Mounts a customer module only when the public portal menu exposes it. */
export function PortalModuleGuard({ moduleName }: PortalModuleGuardProps) {
  const context = useOutletContext<CustomerAppOutletContext>()
  const { menu } = context
  const canonicalModule = toCanonicalModuleName(moduleName)
  const isAvailable = isCustomerNavModule(canonicalModule) && menu.some(
    (item) => toCanonicalModuleName(item.moduleName) === canonicalModule,
  )

  // Forward the layout context: module pages read it via useOutletContext.
  return isAvailable ? <Outlet context={context} /> : <PortalNotFoundRoute />
}
