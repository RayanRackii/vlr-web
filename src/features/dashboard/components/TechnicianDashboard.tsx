import { useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Clock3, Info, Play, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { PageHeader } from "@/components/layout/PageHeader"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

export function TechnicianDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { can, activeModules } = usePermissions()
  const canReadWorkOrders = can("os.work_orders.read")
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!canReadWorkOrders) return
    let active = true

    async function loadWorkOrders() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const orders = await getWorkOrders()
        if (active) {
          setWorkOrders(orders)
          setLoadError(null)
        }
      } catch (error: unknown) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : t("dashboard.technician.errors.loadFailed"))
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadWorkOrders()
    return () => { active = false }
  }, [t, canReadWorkOrders, loadAttempt])

  const activeOrders = useMemo(
    () =>
      (canReadWorkOrders ? workOrders : []).filter(
        (workOrder) =>
          workOrder.status === "Pending" || workOrder.status === "InProgress",
      ),
    [workOrders, canReadWorkOrders],
  )

  const pendingCount = activeOrders.filter(
    (workOrder) => workOrder.status === "Pending",
  ).length
  const inProgressCount = activeOrders.filter(
    (workOrder) => workOrder.status === "InProgress",
  ).length

  return (
    <div aria-busy={canReadWorkOrders && isLoading} className="mx-auto w-full min-w-0 max-w-7xl space-y-6 [overflow-wrap:anywhere]">
      <PageHeader
        title={t("dashboard.technician.title")}
        description={t("dashboard.technician.description")}
      />

      {canReadWorkOrders && loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {!canReadWorkOrders ? (
        <Alert variant="info" role="status">
          <Info aria-hidden="true" />
          <AlertDescription>{t("dashboard.limitedNotice")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Wrench}
          title={t("dashboard.technician.metrics.assigned")}
          value={loadError || !canReadWorkOrders ? "—" : activeOrders.length}
          isLoading={canReadWorkOrders && isLoading}
        />
        <MetricCard
          icon={Clock3}
          title={t("dashboard.technician.metrics.pending")}
          value={loadError || !canReadWorkOrders ? "—" : pendingCount}
          isLoading={canReadWorkOrders && isLoading}
        />
        <MetricCard
          icon={ClipboardCheck}
          title={t("dashboard.technician.metrics.inProgress")}
          value={loadError || !canReadWorkOrders ? "—" : inProgressCount}
          isLoading={canReadWorkOrders && isLoading}
        />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t("dashboard.technician.nextOrders.title")}</CardTitle>
          <CardDescription>
            {t("dashboard.technician.nextOrders.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canReadWorkOrders && isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : canReadWorkOrders && loadError ? (
            <EmptyState
              size="sm"
              icon={ClipboardCheck}
              title={t("dashboard.unavailable")}
              action={<Button variant="outline" className="min-h-11" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t("common.retry")}</Button>}
            />
          ) : activeOrders.length === 0 ? (
            <EmptyState
              size="sm"
              icon={ClipboardCheck}
              title={canReadWorkOrders ? t("dashboard.technician.nextOrders.empty") : t("dashboard.limitedTitle")}
              description={canReadWorkOrders && activeModules.includes("os") ? t("dashboard.ordersEmptyHint") : t("dashboard.emptyDescription")}
              action={canReadWorkOrders && activeModules.includes("os") ? (
                <Button variant="outline" className="min-h-11" render={<Link to="/os" />}>
                  {t("dashboard.viewOrders")}
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="space-y-2">
              {activeOrders.slice(0, 5).map((workOrder) => (
                <div
                  key={workOrder.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 font-medium">
                        {workOrder.asset.tag} — {workOrder.asset.name}
                      </p>
                      <Badge
                        variant={
                          workOrder.status === "InProgress" ? "info" : "warning"
                        }
                      >
                        {t(`workOrders.status.${workOrder.status}`)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(i18n.language).format(
                        new Date(`${workOrder.scheduledDate}T00:00:00`),
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      void navigate(`/os/${workOrder.id}`)
                    }}
                  >
                    <Play data-icon="inline-start" />
                    {t("dashboard.technician.nextOrders.open")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  title,
  value,
  isLoading,
}: {
  icon: typeof Wrench
  title: string
  value: string | number
  isLoading: boolean
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="text-3xl font-semibold">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
