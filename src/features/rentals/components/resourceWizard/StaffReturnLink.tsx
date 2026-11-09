import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { safeStaffReturnTo } from "@/features/rentals/components/resourceWizard/staffReturnTo"

export function StaffReturnLink() {
  const { t } = useTranslation()
  const href = safeStaffReturnTo(new URLSearchParams(window.location.search).get("returnTo"))
  if (!href) {
    return null
  }
  return (
    <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={href}>
      {t("rentals.resourceWizard.returnToWizard")}
    </Link>
  )
}
