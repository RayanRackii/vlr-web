import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { isStaffHomeRedirect } from "@/components/layout/staffHomeRedirect"

export function StaffHomeRedirectNotice() {
  const { t } = useTranslation()
  const location = useLocation()

  if (!isStaffHomeRedirect(location.state)) {
    return null
  }

  return (
    <p
      role="status"
      className="border-b border-border bg-muted/40 px-4 py-2 text-sm text-foreground"
    >
      {t("nav.dashboardRedirectNotice")}
    </p>
  )
}
