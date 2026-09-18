import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ClipboardList } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Can } from "@/features/users/permissions/Can"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import { isAxiosError } from "@/lib/api"

function formatScheduledDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function statusBadgeVariant(status: WorkOrder["status"]) {
  if (status === "Completed") {
    return "success" as const
  }
  if (status === "InProgress") {
    return "warning" as const
  }
  return "secondary" as const
}

export function PlanRelatedWorkOrders({
  planId,
  refreshKey,
  onGenerate,
}: {
  planId: string
  refreshKey: number
  onGenerate?: () => void
}) {
  const { t, i18n } = useTranslation()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadRelated = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getWorkOrders({ maintenancePlanId: planId })
      setWorkOrders(data)
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error(
          "PlanRelatedWorkOrders loadRelated response",
          error.response?.data,
        )
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : t("workOrders.errors.loadFailed"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [planId, t])

  useEffect(() => {
    void loadRelated()
  }, [loadRelated, refreshKey])

  return (
    <section
      data-testid="related-work-orders"
      className="space-y-4 rounded-xl border border-border p-4 sm:p-6"
    >
      <h2 className="text-lg font-medium">
        {t("pmoc.plans.sections.relatedWorkOrders")}
      </h2>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("workOrders.loading")}</p>
      ) : null}

      {!isLoading && workOrders.length === 0 && loadError === null ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="size-6" aria-hidden />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("pmoc.plans.related.empty")}
          </p>
          {onGenerate ? (
            <Can permission="os.work_orders.create">
              <Button type="button" variant="outline" onClick={onGenerate}>
                {t("pmoc.plans.actions.generateWorkOrder")}
              </Button>
            </Can>
          ) : null}
        </div>
      ) : null}

      {!isLoading && workOrders.length > 0 ? (
        <ul className="divide-y rounded-lg border border-border">
          {workOrders.map((workOrder) => (
            <li
              key={workOrder.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(workOrder.status)}>
                    {t(`workOrders.status.${workOrder.status}`)}
                  </Badge>
                  <p className="text-sm font-medium">
                    {workOrder.asset.tag} — {workOrder.asset.name}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span>
                    {formatScheduledDate(workOrder.scheduledDate, i18n.language)}
                  </span>
                  {workOrder.assignedUser ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{workOrder.assignedUser.fullName}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <Link
                to={`/os/${workOrder.id}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "self-start sm:self-auto",
                })}
              >
                {t("workOrders.actions.open")}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
