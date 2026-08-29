import { Navigate, useOutletContext } from "react-router-dom"
import { useTranslation } from "react-i18next"

import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { buildCustomerNavItems } from "@/features/catalog/customerNav"

/** Redirects to the first B2C menu item (or empty state). */
export function TenantPortalHomePage() {
  const { t } = useTranslation()
  const { subdomain, menu } = useOutletContext<CustomerAppOutletContext>()

  const first = buildCustomerNavItems(subdomain, menu, t)[0]

  if (first) {
    return <Navigate to={first.to} replace />
  }

  return (
    <div className="mx-auto max-w-lg space-y-2 py-10 text-center">
      <h2 className="text-lg font-semibold">
        {t("tenantPortal.menu.emptyTitle")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("tenantPortal.menu.emptyDescription")}
      </p>
    </div>
  )
}
