import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Clock3, Play, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

export function TechnicianDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      setWorkOrders(await getWorkOrders())
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("dashboard.technician.errors.loadFailed"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadWorkOrders()
  }, [loadWorkOrders])

  const activeOrders = useMemo(
    () =>
      workOrders.filter(
        (workOrder) =>
          workOrder.status === "Pending" || workOrder.status === "InProgress",
      ),
    [workOrders],
  )

  const pendingCount = activeOrders.filter(
    (workOrder) => workOrder.status === "Pending",
  ).length
  const inProgressCount = activeOrders.filter(
    (workOrder) => workOrder.status === "InProgress",
  ).length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.technician.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.technician.description")}
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Wrench}
          title={t("dashboard.technician.metrics.assigned")}
          value={activeOrders.length}
          isLoading={isLoading}
        />
        <MetricCard
          icon={Clock3}
          title={t("dashboard.technician.metrics.pending")}
          value={pendingCount}
          isLoading={isLoading}
        />
        <MetricCard
          icon={ClipboardCheck}
          title={t("dashboard.technician.metrics.inProgress")}
          value={inProgressCount}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.technician.nextOrders.title")}</CardTitle>
          <CardDescription>
            {t("dashboard.technician.nextOrders.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : activeOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.technician.nextOrders.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {activeOrders.slice(0, 5).map((workOrder) => (
                <div
                  key={workOrder.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {workOrder.asset.tag} — {workOrder.asset.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(i18n.language).format(
                        new Date(`${workOrder.scheduledDate}T00:00:00`),
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
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
  value: number
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
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
