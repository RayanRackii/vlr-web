import { LayoutGridIcon } from "lucide-react"
import { Navigate, useOutletContext } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/ui/empty-state"
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
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={LayoutGridIcon}
        title={t("tenantPortal.menu.emptyTitle")}
        description={t("tenantPortal.menu.emptyDescription")}
      />
    </div>
  )
}
