import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { BILLING_PAGE_PATH, BILLING_PERMISSION } from "@/features/billing/lib/subscriptionView"
import { getMySubscription } from "@/features/billing/services/subscriptionService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { queryClient } from "@/lib/queryClient"
import { tenantKey } from "@/lib/queryKeys"

const STALE_MS = 5 * 60 * 1000

/**
 * Payment-state banner for paid tenants. `/me` only carries the trial state, so users who can manage
 * billing read the subscription once (cached per tenant). Trial tenants are covered by TrialBanner and
 * users without the permission never trigger the request.
 */
export function BillingStatusBanner() {
  const { t } = useTranslation()
  const { currentUser, can, isLoading } = usePermissions()
  const tenantId = currentUser?.tenantId ?? null
  const enabled = !isLoading && tenantId !== null && !currentUser?.isTrial && can(BILLING_PERMISSION)
  const { data } = useQuery(
    {
      queryKey: tenantKey("staff", tenantId, "billing-subscription"),
      queryFn: () => getMySubscription(),
      enabled,
      staleTime: STALE_MS,
      retry: false,
    },
    queryClient,
  )

  if (!enabled || !data) return null
  const message =
    data.status === "past_due"
      ? t("billing.statusBanner.pastDue")
      : data.status === "read_only"
        ? t("billing.statusBanner.readOnly")
        : null
  if (!message) return null

  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100"
    >
      {message}{" "}
      <Link to={BILLING_PAGE_PATH} className="font-medium underline underline-offset-2">
        {t("billing.statusBanner.link")}
      </Link>
    </div>
  )
}
