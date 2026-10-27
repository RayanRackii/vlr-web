import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AuthenticatedNotFoundPage } from "@/components/layout/AuthenticatedNotFoundPage"
import { MainLayout } from "@/components/layout/MainLayout"
import { PublicNotFoundPage } from "@/components/layout/PublicNotFoundPage"
import { useAuth } from "@/contexts/AuthContext"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"
import { signedInCustomerSubdomain } from "@/lib/sessionRestoreGuard"

/**
 * Signed-out visitors see a standalone 404 (no admin chrome).
 * Signed-in staff stay in the app shell and see a not-found page.
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

  if (user !== null) {
    return (
      <MainLayout>
        <AuthenticatedNotFoundPage />
      </MainLayout>
    )
  }

  return <PublicNotFoundPage />
}
