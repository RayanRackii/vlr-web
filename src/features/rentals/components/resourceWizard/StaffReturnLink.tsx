import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { safeStaffReturnTo } from "@/features/rentals/components/resourceWizard/staffReturnTo"

type StaffReturnLinkProps = {
  /** Return false to stay on the page, the same way other schedule navigation does. */
  beforeNavigate?: () => boolean
}

export function StaffReturnLink({ beforeNavigate }: StaffReturnLinkProps) {
  const { t } = useTranslation()
  const href = safeStaffReturnTo(new URLSearchParams(window.location.search).get("returnTo"))
  if (!href) {
    return null
  }
  return (
    <Link
      className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      to={href}
      onClick={(event) => {
        if (beforeNavigate && !beforeNavigate()) {
          event.preventDefault()
        }
      }}
    >
      {t("rentals.resourceWizard.returnToWizard")}
    </Link>
  )
}
