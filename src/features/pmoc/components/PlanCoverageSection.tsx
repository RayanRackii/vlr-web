import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { StatusBadge } from "@/components/ui/status"
import type { StatusTone } from "@/components/ui/status-tones"
import { buttonVariants } from "@/components/ui/button"
import {
  formatCivilDateHuman,
  formatInstantHuman,
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

function dueTone(status: PmocDueStatus): StatusTone {
  if (status === "Overdue") {
    return "danger"
  }
  if (status === "DueToday") {
    return "warning"
  }
  return "success"
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
    return formatInstantHuman(asset.lastMaintenance.completedDate, locale)
  }

  return formatCivilDateHuman(asset.lastMaintenance.scheduledDate, locale)
}

function OpenOrder({
  asset,
  canOpenOs,
  emptyLabel,
  statusLabel,
}: {
  asset: MaintenancePlanCoverageAssetItem
  canOpenOs: boolean
  emptyLabel: string
  statusLabel: (status: string) => string
}) {
  if (asset.openWorkOrder == null) {
    return <span className="text-muted-foreground">{emptyLabel}</span>
  }
  if (!canOpenOs) {
    return <span>{statusLabel(asset.openWorkOrder.status)}</span>
  }
  return (
    <Link
      to={`/os/${asset.openWorkOrder.workOrderId}`}
      data-testid="coverage-open-work-order-link"
      className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0")}
    >
      {statusLabel(asset.openWorkOrder.status)}
    </Link>
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
  const emptyValue = t("pmoc.plans.emptyValue")
  const statusLabel = (status: string) => t(`workOrders.status.${status}`)
  const overdue = coverage?.summary.assetsOverdue ?? 0
  const dueToday = coverage?.summary.assetsDueToday ?? 0

  const renderAsset = (asset: MaintenancePlanCoverageAssetItem) => (
    <div className="min-w-0">
      <p className="font-medium [overflow-wrap:anywhere]">{asset.name}</p>
      <p className="text-xs text-muted-foreground">{asset.tag}</p>
    </div>
  )
  const renderStatus = (asset: MaintenancePlanCoverageAssetItem) => (
    <StatusBadge tone={dueTone(asset.dueStatus)}>
      {t(`pmoc.plans.coverage.due.${asset.dueStatus}`)}
    </StatusBadge>
  )
  const lastLabel = (asset: MaintenancePlanCoverageAssetItem) =>
    lastMaintenanceLabel(asset, locale, t("pmoc.plans.coverage.history.NeverExecuted"))

  const columns: DataListColumn<MaintenancePlanCoverageAssetItem>[] = [
    { id: "asset", header: t("pmoc.planDetail.coverage.columns.asset"), cell: renderAsset },
    {
      id: "last",
      header: t("pmoc.planDetail.coverage.columns.last"),
      className: "whitespace-nowrap",
      cell: (asset) => <span data-testid="coverage-last-maintenance">{lastLabel(asset)}</span>,
    },
    {
      id: "nextDue",
      header: t("pmoc.planDetail.coverage.columns.nextDue"),
      className: "whitespace-nowrap",
      cell: (asset) => (
        <span data-testid="coverage-next-due">
          {formatCivilDateHuman(asset.effectiveNextDueDate, locale)}
        </span>
      ),
    },
    {
      id: "status",
      header: t("pmoc.planDetail.coverage.columns.status"),
      cell: (asset) => <span data-testid="coverage-due-status">{renderStatus(asset)}</span>,
    },
    {
      id: "openOrder",
      header: t("pmoc.planDetail.coverage.columns.openOrder"),
      cell: (asset) => (
        <span data-testid="coverage-open-work-order">
          <OpenOrder asset={asset} canOpenOs={canOpenOs} emptyLabel={emptyValue} statusLabel={statusLabel} />
        </span>
      ),
    },
  ]

  return (
    <section data-testid="plan-coverage" className="space-y-3">
      <h2 className="text-lg font-medium">{t("pmoc.plans.sections.coverage")}</h2>

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
              {t("pmoc.planDetail.coverage.inactive")}
            </p>
          ) : null}

          <p
            data-testid="coverage-summary"
            data-tone={overdue > 0 ? "danger" : "neutral"}
            className={cn(
              "text-sm",
              overdue > 0 ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {t("pmoc.planDetail.coverage.overdue", { count: overdue })}
            {" · "}
            {t("pmoc.planDetail.coverage.dueToday", { count: dueToday })}
          </p>

          {coverage.summary.eligibleAssets === 0 ? (
            <p data-testid="coverage-empty" className="text-sm text-muted-foreground">
              {t("pmoc.plans.coverage.empty")}
            </p>
          ) : (
            <DataList<MaintenancePlanCoverageAssetItem>
              label={t("pmoc.plans.sections.coverage")}
              columns={columns}
              rows={coverage.assets}
              getRowId={(asset) => asset.assetId}
              rowAttributes={(asset) => ({
                "data-testid": "coverage-asset-row",
                "data-history-status": asset.historyStatus,
                "data-due-status": asset.dueStatus,
                "data-needs-attention": String(asset.needsAttention),
              })}
              empty={{ title: t("pmoc.plans.coverage.empty") }}
              renderCard={(asset) => (
                <>
                  <div className="flex items-start justify-between gap-3">
                    {renderAsset(asset)}
                    {renderStatus(asset)}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("pmoc.planDetail.coverage.columns.last")}
                      </dt>
                      <dd>{lastLabel(asset)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("pmoc.planDetail.coverage.columns.nextDue")}
                      </dt>
                      <dd>{formatCivilDateHuman(asset.effectiveNextDueDate, locale)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">
                        {t("pmoc.planDetail.coverage.columns.openOrder")}
                      </dt>
                      <dd>
                        <OpenOrder asset={asset} canOpenOs={canOpenOs} emptyLabel={emptyValue} statusLabel={statusLabel} />
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
