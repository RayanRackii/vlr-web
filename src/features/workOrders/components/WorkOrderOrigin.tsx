import { Link } from "react-router-dom"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export function formatWorkOrderOriginText(
  maintenancePlanId: string | null | undefined,
  sourcePlanName: string | null | undefined,
  t: TFunction,
): string {
  if (!maintenancePlanId) {
    return t("workOrders.origin.manual")
  }

  const name = sourcePlanName?.trim()
  if (!name) {
    return t("workOrders.origin.pmoc")
  }

  return t("workOrders.origin.pmocWithName", { name })
}

export function WorkOrderOrigin({
  maintenancePlanId,
  sourcePlanName,
}: {
  maintenancePlanId: string | null | undefined
  sourcePlanName: string | null | undefined
}) {
  const { t } = useTranslation()
  const { activeModules } = usePermissions()
  const text = formatWorkOrderOriginText(maintenancePlanId, sourcePlanName, t)
  const pmocModuleActive = activeModules.some(
    (module) => module.trim().toLowerCase() === "pmoc",
  )

  if (!maintenancePlanId) {
    return <span>{text}</span>
  }

  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 break-words">
      <span>{text}</span>
      {pmocModuleActive ? (
        <Can permission="pmoc.plans.read">
          <Link
            to={`/pmoc/${maintenancePlanId}`}
            className="touch-target inline-flex max-w-full items-center whitespace-normal rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("workOrders.origin.viewPlan")}
          </Link>
        </Can>
      ) : null}
    </span>
  )
}
