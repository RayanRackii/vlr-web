import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { StaffNotFoundPage } from "@/components/layout/StaffNotFoundPage"
import { useAuth } from "@/contexts/AuthContext"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"
import { signedInCustomerSubdomain } from "@/lib/sessionRestoreGuard"

/**
 * Staff and signed-out visitors see a branded 404 in the auth shell.
 * A signed-in customer is sent back to their portal, even if a staff session lingers.
 */
export function UnknownPathRoute() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </main>
    )
  }

  const customerSubdomain = signedInCustomerSubdomain()
  if (customerSubdomain) {
    return <Navigate to={tenantPortalPath(customerSubdomain, "app")} replace />
  }

  return <StaffNotFoundPage signedIn={user !== null} />
}
