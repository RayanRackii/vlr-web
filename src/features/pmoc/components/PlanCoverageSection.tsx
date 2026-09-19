import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Layers } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatBrazilInstantDate,
  formatCivilDateOnly,
} from "@/features/pmoc/lib/formatCivilDate"
import type {
  MaintenancePlanCoverage,
  MaintenancePlanCoverageAssetItem,
  PmocOperationalStatus,
} from "@/features/pmoc/schemas/coverageSchemas"
import { getPlanCoverage } from "@/features/pmoc/services/pmocService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { isAxiosError } from "@/lib/api"
import { cn } from "@/lib/utils"

function statusBadgeVariant(status: PmocOperationalStatus) {
  if (status === "Overdue") {
    return "destructive" as const
  }
  if (status === "NeverExecuted") {
    return "warning" as const
  }
  return "success" as const
}

function summaryValueClassName(
  key: string,
  value: number,
): string | undefined {
  if (value <= 0) {
    return undefined
  }
  if (key === "overdue") {
    return "text-destructive"
  }
  if (key === "never") {
    return "text-amber-700 dark:text-amber-300"
  }
  if (key === "onTrack") {
    return "text-emerald-700 dark:text-emerald-300"
  }
  return undefined
}

function stateDotClassName(isOn: boolean): string {
  return cn(
    "size-1.5 shrink-0 rounded-full",
    isOn ? "bg-emerald-500" : "bg-muted-foreground/50",
  )
}

function lastMaintenanceLabel(
  asset: MaintenancePlanCoverageAssetItem,
  locale: string,
  neverExecuted: string,
): string {
  if (asset.lastMaintenance == null) {
    return neverExecuted
  }

  if (asset.lastMaintenance.completedDate) {
    return formatBrazilInstantDate(asset.lastMaintenance.completedDate, locale)
  }

  return formatCivilDateOnly(asset.lastMaintenance.scheduledDate, locale)
}

function consideredMessage(
  coverage: MaintenancePlanCoverage,
  t: (key: string) => string,
): string {
  if (coverage.wouldBeConsideredByGenerator) {
    return t("pmoc.plans.coverage.consideredToday")
  }
  if (!coverage.isActive) {
    return t("pmoc.plans.coverage.planInactive")
  }
  if (!coverage.autoGenerateEnabled) {
    return t("pmoc.plans.coverage.automationDisabled")
  }
  if (!coverage.isDueToday) {
    return t("pmoc.plans.coverage.notDueToday")
  }

  return t("pmoc.plans.coverage.notDueToday")
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
          },
          {
            key: "never",
            label: t("pmoc.plans.coverage.summaryNever"),
            value: coverage.summary.assetsNeverExecuted,
          },
          {
            key: "overdue",
            label: t("pmoc.plans.coverage.summaryOverdue"),
            value: coverage.summary.assetsOverdue,
          },
          {
            key: "onTrack",
            label: t("pmoc.plans.coverage.summaryOnTrack"),
            value: coverage.summary.assetsOnTrack,
          },
          {
            key: "open",
            label: t("pmoc.plans.coverage.summaryOpen"),
            value: coverage.summary.assetsWithOpenWorkOrder,
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
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              {t("pmoc.plans.coverage.inactiveNote")}
            </p>
          ) : null}

          <div
            data-testid="coverage-calendar"
            data-as-of-date={coverage.asOfDate}
            data-last-due-date={coverage.lastDueDate}
            data-next-due-date={coverage.nextDueDate}
            data-is-due-today={String(coverage.isDueToday)}
            data-would-be-considered={String(
              coverage.wouldBeConsideredByGenerator,
            )}
            className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:px-4 lg:grid-cols-5"
          >
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {t("pmoc.plans.coverage.calendar.automation")}
              </p>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <span
                  aria-hidden="true"
                  className={stateDotClassName(coverage.autoGenerateEnabled)}
                />
                {coverage.autoGenerateEnabled
                  ? t("pmoc.plans.coverage.calendar.automationOn")
                  : t("pmoc.plans.coverage.calendar.automationOff")}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {t("pmoc.plans.coverage.calendar.asOfDate")}
              </p>
              <p
                data-testid="coverage-as-of-date"
                className="text-sm font-medium tabular-nums"
              >
                {formatCivilDateOnly(coverage.asOfDate, locale)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {t("pmoc.plans.coverage.calendar.lastDueDate")}
              </p>
              <p
                data-testid="coverage-last-due-date"
                className="text-sm font-medium tabular-nums"
              >
                {formatCivilDateOnly(coverage.lastDueDate, locale)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {t("pmoc.plans.coverage.calendar.nextDueDate")}
              </p>
              <p
                data-testid="coverage-plan-next-due"
                className="text-sm font-medium tabular-nums"
              >
                {formatCivilDateOnly(coverage.nextDueDate, locale)}
              </p>
            </div>
            <div className="col-span-2 space-y-0.5 lg:col-span-1">
              <p className="text-xs text-muted-foreground">
                {t("pmoc.plans.coverage.calendar.considered")}
              </p>
              <p
                data-testid="coverage-considered"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <span
                  aria-hidden="true"
                  className={stateDotClassName(
                    coverage.wouldBeConsideredByGenerator,
                  )}
                />
                {consideredMessage(coverage, t)}
              </p>
            </div>
          </div>

          <dl
            data-testid="coverage-summary"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            {summaryItems.map((item) => (
              <div
                key={item.key}
                className={cn(
                  "space-y-0.5 rounded-lg border border-border px-3 py-2",
                  item.key === "open" ? "col-span-2 sm:col-span-1" : undefined,
                )}
              >
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd
                  data-testid={`coverage-summary-${item.key}`}
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    summaryValueClassName(item.key, item.value),
                  )}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {coverage.summary.eligibleAssets === 0 ? (
            <div
              data-testid="coverage-empty"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Layers className="size-6" aria-hidden />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("pmoc.plans.coverage.empty")}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pmoc.plans.coverage.columns.tag")}</TableHead>
                    <TableHead>{t("pmoc.plans.coverage.columns.name")}</TableHead>
                    <TableHead>
                      {t("pmoc.plans.coverage.columns.status")}
                    </TableHead>
                    <TableHead>
                      {t("pmoc.plans.coverage.columns.lastMaintenance")}
                    </TableHead>
                    <TableHead>
                      {t("pmoc.plans.coverage.columns.nextDue")}
                    </TableHead>
                    <TableHead>
                      {t("pmoc.plans.coverage.columns.openWorkOrder")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverage.assets.map((asset) => (
                    <TableRow
                      key={asset.assetId}
                      data-testid="coverage-asset-row"
                      data-operational-status={asset.operationalStatus}
                    >
                      <TableCell className="font-medium">{asset.tag}</TableCell>
                      <TableCell className="whitespace-normal">
                        {asset.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          data-testid="coverage-operational-status"
                          variant={statusBadgeVariant(asset.operationalStatus)}
                        >
                          {t(
                            `pmoc.plans.coverage.status.${asset.operationalStatus}`,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell
                        data-testid="coverage-last-maintenance"
                        className="min-w-32 whitespace-normal"
                      >
                        {lastMaintenanceLabel(
                          asset,
                          locale,
                          t("pmoc.plans.coverage.neverExecuted"),
                        )}
                      </TableCell>
                      <TableCell
                        data-testid="coverage-next-due"
                        className="tabular-nums"
                      >
                        {formatCivilDateOnly(asset.nextDueDate, locale)}
                      </TableCell>
                      <TableCell className="min-w-36 whitespace-normal">
                        {asset.openWorkOrder ? (
                          <div
                            data-testid="coverage-open-work-order"
                            className="flex flex-col items-start gap-1.5"
                          >
                            <span className="text-sm">
                              {t(
                                `workOrders.status.${asset.openWorkOrder.status}`,
                              )}{" "}
                              ·{" "}
                              {formatCivilDateOnly(
                                asset.openWorkOrder.scheduledDate,
                                locale,
                              )}
                            </span>
                            {canOpenOs ? (
                              <Link
                                data-testid="coverage-open-work-order-link"
                                to={`/os/${asset.openWorkOrder.workOrderId}`}
                                className={buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                })}
                              >
                                {t("workOrders.actions.open")}
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
