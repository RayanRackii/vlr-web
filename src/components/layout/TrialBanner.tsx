import { useTranslation } from "react-i18next"
import { Info } from "lucide-react"
import { Link } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { BILLING_PAGE_PATH, BILLING_PERMISSION } from "@/features/billing/lib/subscriptionView"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) {
    return null
  }
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) {
    return null
  }
  const diff = target - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

export function TrialBanner({ informational = false }: { informational?: boolean }) {
  const { t } = useTranslation()
  const { currentUser: profile, can } = usePermissions()

  if (!profile?.isTrial) {
    return null
  }

  const planLink = can(BILLING_PERMISSION) ? (
    <>
      {" "}
      <Link to={BILLING_PAGE_PATH} className="font-medium underline underline-offset-2">
        {t("trial.banner.manage")}
      </Link>
    </>
  ) : null

  if (profile.isTrialReadOnly) {
    const purgeDays = daysUntil(profile.trialPurgeAt)
    if (informational) {
      return (
        <Alert variant="info" role="status" className="rounded-none border-x-0 border-t-0 px-4">
          <Info aria-hidden="true" />
          <AlertDescription>
            {t("dashboard.readOnlyNotice", { days: purgeDays ?? "—" })}
            {planLink}
          </AlertDescription>
        </Alert>
      )
    }
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
        {t("trial.banner.readOnly", {
          days: purgeDays ?? "—",
        })}
        {planLink}
      </div>
    )
  }

  const remaining = daysUntil(profile.trialEndsAt)
  return (
    <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
      {t("trial.banner.active", {
        days: remaining ?? "—",
      })}
      {planLink}
    </div>
  )
}
