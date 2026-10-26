import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useOutletContext } from "react-router-dom"

import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

/** Portal has no direct-link reset flow (only the emailed-code screen), so any `reset-password` hit is stale. */
export function TenantPortalInvalidResetLinkPage() {
  const { t } = useTranslation()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  return (
    <div className="space-y-4">
      <p
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15 dark:text-destructive-foreground"
      >
        {t("tenantPortal.passwordReset.invalidLink")}
      </p>
      <p className="text-center text-sm">
        <Link
          to={tenantPortalPath(subdomain, "forgot-password")}
          className="inline-flex min-h-11 items-center font-medium text-primary underline"
        >
          {t("tenantPortal.passwordReset.requestNewLink")}
        </Link>
      </p>
    </div>
  )
}
