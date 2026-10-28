import { CompassIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useOutletContext, useParams } from "react-router-dom"

import type { CustomerAppOutletContext } from "./CustomerAppLayout"
import { PortalRecoveryState } from "./portal/PortalRecoveryState"
import type { ModuleMenuItem } from "../schemas/tenantPortalSchemas"
import { fetchTenantMenu, isCustomerSignedInForTenant, menuItemAgendaPath, tenantPortalPath } from "../services/tenantPortalService"

type PortalNotFoundRouteProps = {
  /** Set when the tenant slug itself does not exist, so "home" leaves the dead subdomain instead of looping back to it. */
  tenantExists?: boolean
}

/** Portal-only fallback; it never redirects into the staff application. */
export function PortalNotFoundRoute({
  tenantExists = true,
}: PortalNotFoundRouteProps) {
  const { t } = useTranslation()
  const params = useParams<{ subdomain: string }>()
  const context = useOutletContext<Partial<CustomerAppOutletContext> | undefined>()
  const subdomain = params.subdomain ?? context?.subdomain
  const signedIn = Boolean(tenantExists && subdomain && isCustomerSignedInForTenant(subdomain))
  const [loadedMenu, setLoadedMenu] = useState<{ subdomain: string; items: ModuleMenuItem[] } | null>(null)
  const contextMenu = context?.menu

  useEffect(() => {
    if (!signedIn || !subdomain || contextMenu) return
    let cancelled = false
    void fetchTenantMenu(subdomain).then((items) => {
      if (!cancelled) setLoadedMenu({ subdomain, items })
    }).catch(() => {
      // The recovery action remains usable when optional menu discovery fails.
    })
    return () => { cancelled = true }
  }, [signedIn, subdomain, contextMenu])

  const menu = contextMenu ?? (loadedMenu && loadedMenu.subdomain === subdomain ? loadedMenu.items : [])
  const booking = signedIn ? menu.find((item) => item.isActive && item.moduleName.toLowerCase() === "rentals") : undefined
  const home = subdomain && tenantExists ? tenantPortalPath(subdomain, signedIn ? "app" : "") : "/"

  return (
    <PortalRecoveryState
      icon={CompassIcon}
      title={t("notFound.title")}
      description={t("tenantPortal.notFound.description")}
      primaryAction={{ to: home, label: t("notFound.home") }}
      secondaryAction={booking && subdomain ? {
        to: menuItemAgendaPath(subdomain, booking.id),
        label: t("tenantPortal.notFound.book"),
      } : undefined}
    />
  )
}
