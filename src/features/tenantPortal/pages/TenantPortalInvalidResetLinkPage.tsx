import { KeyRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useOutletContext } from "react-router-dom"

import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"
import { PortalRecoveryState } from "../components/portal/PortalRecoveryState"

/** Portal has no direct-link reset flow (only the emailed-code screen), so any `reset-password` hit is stale. */
export function TenantPortalInvalidResetLinkPage() {
  const { t } = useTranslation()
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  return (
    <PortalRecoveryState
      icon={KeyRound}
      title={t("tenantPortal.passwordReset.invalidLinkTitle")}
      description={t("tenantPortal.passwordReset.invalidLink")}
      alert
      primaryAction={{
        to: tenantPortalPath(subdomain, "forgot-password"),
        label: t("tenantPortal.passwordReset.requestNewLink"),
      }}
    />
  )
}
