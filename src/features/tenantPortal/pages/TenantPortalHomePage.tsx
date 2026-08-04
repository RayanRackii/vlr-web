import { useTranslation } from "react-i18next"
import { Link, useOutletContext } from "react-router-dom"

import { Button } from "@/components/ui/button"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import {
  clearCustomerSession,
  getCustomerAccessToken,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export function TenantPortalHomePage() {
  const { t } = useTranslation()
  const { subdomain, branding, primary } =
    useOutletContext<TenantPortalOutletContext>()
  const signedIn = getCustomerAccessToken() !== null

  return (
    <div className="space-y-4 text-center">
      <h2 className="text-lg font-semibold">
        {t("tenantPortal.app.welcome", { name: branding.displayName })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {signedIn
          ? t("tenantPortal.app.signedInHint")
          : t("tenantPortal.app.signedOutHint")}
      </p>
      {signedIn ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            clearCustomerSession()
            window.location.assign(tenantPortalPath(subdomain))
          }}
        >
          {t("tenantPortal.app.signOut")}
        </Button>
      ) : (
        <Button
          type="button"
          className="w-full"
          style={{ backgroundColor: primary }}
          render={<Link to={tenantPortalPath(subdomain)} />}
        >
          {t("tenantPortal.app.goLogin")}
        </Button>
      )}
    </div>
  )
}
