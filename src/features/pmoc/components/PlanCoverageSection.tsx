import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  formatBrazilInstantDate,
  formatCivilDateOnly,
} from "@/features/pmoc/lib/formatCivilDate"
import type {
  MaintenancePlanCoverage,
  MaintenancePlanCoverageAssetItem,
  PmocDueStatus,
} from "@/features/pmoc/schemas/coverageSchemas"
import { getPlanCoverage } from "@/features/pmoc/services/pmocService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { isAxiosError } from "@/lib/api"
import { cn } from "@/lib/utils"

function dueBadgeVariant(status: PmocDueStatus) {
  if (status === "Overdue") {
    return "destructive" as const
  }
  if (status === "DueToday") {
    return "warning" as const
  }
  return "success" as const
}

function consideredMessage(
  coverage: MaintenancePlanCoverage,
  t: (key: string) => string,
): string {
  if (coverage.wouldBeConsideredByGenerator) {
    return t("pmoc.plans.coverage.consideredPossible")
  }
  if (!coverage.isActive) {
    return t("pmoc.plans.coverage.planInactive")
  }
  if (!coverage.autoGenerateEnabled) {
    return t("pmoc.plans.coverage.automationDisabled")
  }
  return t("pmoc.plans.coverage.nothingDue")
}

function lastMaintenanceLabel(
  asset: MaintenancePlanCoverageAssetItem,
  locale: string,
  neverExecuted: string,
): string {
  if (
    asset.historyStatus === "NeverExecuted" ||
    asset.lastMaintenance == null
  ) {
    return neverExecuted
  }

  if (asset.lastMaintenance.completedDate) {
    return formatBrazilInstantDate(asset.lastMaintenance.completedDate, locale)
  }

  return formatCivilDateOnly(asset.lastMaintenance.scheduledDate, locale)
}

function AssetFields({
  asset,
  locale,
  canOpenOs,
  t,
}: {
  asset: MaintenancePlanCoverageAssetItem
  locale: string
  canOpenOs: boolean
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <>
      <div className="min-w-0">
        <p className="font-medium">{asset.name}</p>
        <p className="text-xs text-muted-foreground">{asset.tag}</p>
      </div>
      <p data-testid="coverage-last-maintenance">
        {lastMaintenanceLabel(
          asset,
          locale,
          t("pmoc.plans.coverage.history.NeverExecuted"),
        )}
      </p>
      <p data-testid="coverage-next-due">
        {formatCivilDateOnly(asset.effectiveNextDueDate, locale)}
      </p>
      <Badge
        data-testid="coverage-due-status"
        variant={dueBadgeVariant(asset.dueStatus)}
      >
        {t(`pmoc.plans.coverage.due.${asset.dueStatus}`)}
      </Badge>
      <div data-testid="coverage-open-work-order">
        {asset.openWorkOrder == null ? (
          t("pmoc.plans.emptyValue")
        ) : canOpenOs ? (
          <Link
            to={`/os/${asset.openWorkOrder.workOrderId}`}
            data-testid="coverage-open-work-order-link"
            className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0")}
          >
            {t(`workOrders.status.${asset.openWorkOrder.status}`)}
          </Link>
        ) : (
          t(`workOrders.status.${asset.openWorkOrder.status}`)
        )}
      </div>
    </>
  )
}

export function PlanCoverageSection({
  planId,
  refreshKey,
}: {
  planId: string
  refreshKey: number
}) {
  const { t, i18n } = useTranslation()
  const { can, activeModules } = usePermissions()
  const osModuleActive = activeModules.some(
    (module) => module.trim().toLowerCase() === "os",
  )
  const canOpenOs = osModuleActive && can("os.work_orders.read")

  const [coverage, setCoverage] = useState<MaintenancePlanCoverage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadCoverage = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getPlanCoverage(planId)
      setCoverage(data)
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error(
          "PlanCoverageSection loadCoverage response",
          error.response?.data,
        )
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : t("pmoc.plans.coverage.errors.loadFailed"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [planId, t])

  useEffect(() => {
    void loadCoverage()
  }, [loadCoverage, refreshKey])

  const locale = i18n.language
  const summaryItems =
    coverage == null
      ? []
      : [
          {
            key: "eligible",
            label: t("pmoc.plans.coverage.summaryEligible"),
            value: coverage.summary.eligibleAssets,
            emphasize: false,
          },
          {
            key: "attention",
            label: t("pmoc.plans.coverage.summaryAttention"),
            value: coverage.summary.assetsNeedingAttention,
            emphasize: coverage.summary.assetsNeedingAttention > 0,
          },
          {
            key: "dueToday",
            label: t("pmoc.plans.coverage.summaryDueToday"),
            value: coverage.summary.assetsDueToday,
            emphasize: coverage.summary.assetsDueToday > 0,
          },
          {
            key: "overdue",
            label: t("pmoc.plans.coverage.summaryOverdue"),
            value: coverage.summary.assetsOverdue,
            emphasize: coverage.summary.assetsOverdue > 0,
          },
        ]

  return (
    <section
      data-testid="plan-coverage"
      className="space-y-4 rounded-xl border border-border p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("pmoc.plans.sections.coverage")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("pmoc.plans.coverage.question")}
        </p>
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("pmoc.plans.coverage.loading")}
        </p>
      ) : null}

      {!isLoading && coverage != null ? (
        <>
          {!coverage.isActive ? (
            <p
              data-testid="coverage-inactive-note"
              className="text-sm text-muted-foreground"
            >
              {t("pmoc.plans.coverage.inactiveNote")}
            </p>
          ) : null}

          <p className="text-sm text-muted-foreground" data-testid="coverage-as-of-date">
            {t("pmoc.plans.coverage.asOf", {
              date: formatCivilDateOnly(coverage.asOfDate, locale),
            })}
          </p>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="coverage-summary">
            {summaryItems.map((item) => (
              <div key={item.key} className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd
                  data-testid={`coverage-summary-${item.key}`}
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    item.emphasize && item.key === "overdue" && "text-destructive",
                    item.emphasize && item.key === "dueToday" && "text-amber-700 dark:text-amber-300",
                  )}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-sm text-muted-foreground">
            <span data-testid="coverage-summary-never">
              {t("pmoc.plans.coverage.summaryNever")}: {coverage.summary.assetsNeverExecuted}
            </span>
            {" · "}
            <span data-testid="coverage-summary-open">
              {t("pmoc.plans.coverage.summaryOpen")}: {coverage.summary.assetsWithOpenWorkOrder}
            </span>
          </p>

          <p data-testid="coverage-considered" className="text-sm">
            {consideredMessage(coverage, t)}
          </p>

          {coverage.summary.eligibleAssets === 0 ? (
            <p data-testid="coverage-empty" className="text-sm text-muted-foreground">
              {t("pmoc.plans.coverage.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {coverage.assets.map((asset) => (
                <li
                  key={asset.assetId}
                  data-testid="coverage-asset-row"
                  data-history-status={asset.historyStatus}
                  data-due-status={asset.dueStatus}
                  data-needs-attention={String(asset.needsAttention)}
                  className={cn(
                    "grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-2 lg:grid-cols-5",
                    asset.needsAttention && "border-amber-500/40",
                  )}
                >
                  <AssetFields
                    asset={asset}
                    locale={locale}
                    canOpenOs={canOpenOs}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}
