import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AuthenticatedNotFoundPage } from "@/components/layout/AuthenticatedNotFoundPage"
import { MainLayout } from "@/components/layout/MainLayout"
import { PublicNotFoundPage } from "@/components/layout/PublicNotFoundPage"
import { useAuth } from "@/contexts/AuthContext"
import {
  getCustomerSubdomain,
  isCustomerSignedInForTenant,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

/**
 * Signed-out visitors see a standalone 404 (no admin chrome).
 * Signed-in staff stay in the app shell and see a not-found page.
 * A signed-in customer (no staff session) is sent back to their portal instead.
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

  if (user !== null) {
    return (
      <MainLayout>
        <AuthenticatedNotFoundPage />
      </MainLayout>
    )
  }

  const customerSubdomain = getCustomerSubdomain()
  if (customerSubdomain && isCustomerSignedInForTenant(customerSubdomain)) {
    return <Navigate to={tenantPortalPath(customerSubdomain, "app")} replace />
  }

  return <PublicNotFoundPage />
}
