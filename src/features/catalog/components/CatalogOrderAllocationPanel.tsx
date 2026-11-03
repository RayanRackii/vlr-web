import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  formatCatalogDate,
  type CatalogOrder,
  type CatalogOrderAllocationPreview,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  applyCatalogOrderAllocationUsage,
  approveCatalogOrderWithPlanning,
  CatalogForbiddenError,
  CatalogPlanningVersionConflictError,
  previewCatalogOrderAllocation,
} from "@/features/catalog/services/catalogService"
import { getUnits } from "@/features/assets/services/unitsService"
import type { Unit } from "@/features/assets/schemas/unitSchemas"

type CatalogOrderAllocationPanelProps = {
  order: CatalogOrder
  onOrderChange: (order: CatalogOrder) => void
  onReloadNeeded: () => void
}

export function CatalogOrderAllocationPanel({
  order,
  onOrderChange,
  onReloadNeeded,
}: CatalogOrderAllocationPanelProps) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const { can } = usePermissions()

  const schedulableItem = order.items.find(
    (item) => item.productionSummary === "Unscheduled",
  )
  const allocatedItem = order.items.find((item) => item.allocation != null)

  if (schedulableItem == null && allocatedItem == null) {
    return null
  }

  return (
    <div className="space-y-4">
      {schedulableItem && order.status === "Requested" ? (
        <ApprovalPanel
          order={order}
          itemId={schedulableItem.id}
          onOrderChange={onOrderChange}
          onReloadNeeded={onReloadNeeded}
        />
      ) : null}
      {allocatedItem?.allocation ? (
        <ActiveUsageCard
          order={order}
          allocation={allocatedItem.allocation}
          onOrderChange={onOrderChange}
          canAllocate={can("catalog.orders.allocate") && can("catalog.orders.manage")}
          timeZoneId={timeZoneId}
          locale={i18n.language}
          t={t}
        />
      ) : null}
    </div>
  )
}

function ApprovalPanel({
  order,
  itemId,
  onOrderChange,
  onReloadNeeded,
}: {
  order: CatalogOrder
  itemId: string
  onOrderChange: (order: CatalogOrder) => void
  onReloadNeeded: () => void
}) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState<string | null>(null)
  const [workStart, setWorkStart] = useState("")
  const [preview, setPreview] = useState<CatalogOrderAllocationPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [approving, setApproving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getUnits()
      .then((list) => {
        if (cancelled) return
        setUnits(list)
        if (list.length === 1) {
          setUnitId(list[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) setUnits([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runPreview() {
    if (!unitId || !workStart) {
      return
    }
    setPreviewing(true)
    try {
      const result = await previewCatalogOrderAllocation(order.id, {
        unitId,
        workStarts: [{ orderItemId: itemId, workStart: new Date(workStart).toISOString() }],
      })
      setPreview(result)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("catalog.resourcePlanning.errors.previewFailed"),
      )
    } finally {
      setPreviewing(false)
    }
  }

  async function approve() {
    if (!unitId || !workStart) {
      return
    }
    setApproving(true)
    setRefusal(null)
    try {
      const next = await approveCatalogOrderWithPlanning(order.id, {
        unitId,
        workStart: new Date(workStart).toISOString(),
        expectedVersion: order.planningRevision,
      })
      onOrderChange(next)
      toast.success(t("catalog.resourcePlanning.approvalPanel.toastApproved"))
    } catch (error) {
      if (error instanceof CatalogPlanningVersionConflictError) {
        toast.error(error.message)
        onReloadNeeded()
        return
      }
      const message =
        error instanceof CatalogForbiddenError
          ? t("catalog.resourcePlanning.errors.forbidden")
          : error instanceof Error
            ? error.message
            : t("apiErrors.transitionCatalogOrder")
      setRefusal(message)
      toast.error(message)
    } finally {
      setApproving(false)
    }
  }

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-sm font-medium">{t("catalog.resourcePlanning.approvalPanel.title")}</h2>
      <Alert>
        <AlertDescription>
          {t("catalog.resourcePlanning.approvalPanel.previewHint")}
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>{t("catalog.resourcePlanning.approvalPanel.unit")}</span>
          <Select
            modal={false}
            value={unitId}
            onValueChange={(value) => {
              if (typeof value === "string") {
                setUnitId(value)
                setRefusal(null)
              }
            }}
            items={units.map((unit) => ({ value: unit.id, label: unit.name }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("catalog.resourcePlanning.approvalPanel.unitPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t("catalog.resourcePlanning.approvalPanel.workStart")}</span>
          <Input
            type="datetime-local"
            value={workStart}
            onChange={(event) => {
              setWorkStart(event.target.value)
              setPreview(null)
              setRefusal(null)
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <LoadingButton
          type="button"
          variant="outline"
          loading={previewing}
          disabled={!unitId || !workStart}
          onClick={() => void runPreview()}
        >
          {t("catalog.resourcePlanning.approvalPanel.preview")}
        </LoadingButton>
      </div>

      {preview ? (
        preview.isFeasible ? (
          <div className="space-y-1 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <p>
              {t("catalog.resourcePlanning.approvalPanel.workWindow")}:{" "}
              {formatCatalogDate(preview.workStart ?? "", i18n.language, timeZoneId)} –{" "}
              {formatCatalogDate(preview.workEnd ?? "", i18n.language, timeZoneId)}
            </p>
            <p>
              {t("catalog.resourcePlanning.approvalPanel.occupiedWindow")}:{" "}
              {formatCatalogDate(preview.occupiedStart ?? "", i18n.language, timeZoneId)} –{" "}
              {formatCatalogDate(preview.occupiedEnd ?? "", i18n.language, timeZoneId)}
            </p>
            {preview.estimatedReadyAt ? (
              <p>
                {t("catalog.resourcePlanning.approvalPanel.estimatedReadyAt")}:{" "}
                {formatCatalogDate(preview.estimatedReadyAt, i18n.language, timeZoneId)}
              </p>
            ) : null}
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              {preview.reason ?? t("catalog.resourcePlanning.approvalPanel.notFeasible")}
            </AlertDescription>
          </Alert>
        )
      ) : null}

      {refusal ? (
        <Alert variant="destructive">
          <AlertTitle>{t("catalog.resourcePlanning.approvalPanel.refusalTitle")}</AlertTitle>
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}

      <LoadingButton
        type="button"
        loading={approving}
        disabled={
          !unitId || !workStart || refusal != null || (preview != null && !preview.isFeasible)
        }
        onClick={() => void approve()}
      >
        {t("catalog.resourcePlanning.approvalPanel.approveAndAllocate")}
      </LoadingButton>
      <p className="text-xs text-muted-foreground">
        {t("catalog.resourcePlanning.approvalPanel.approvalRule")}
      </p>
    </section>
  )
}

function ActiveUsageCard({
  order,
  allocation,
  onOrderChange,
  canAllocate,
  timeZoneId,
  locale,
  t,
}: {
  order: CatalogOrder
  allocation: NonNullable<CatalogOrder["items"][number]["allocation"]>
  onOrderChange: (order: CatalogOrder) => void
  canAllocate: boolean
  timeZoneId: string
  locale: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const [busyAction, setBusyAction] = useState<"start" | "work-finished" | "release" | null>(null)

  async function runUsage(action: "start" | "work-finished" | "release") {
    setBusyAction(action)
    try {
      const next = await applyCatalogOrderAllocationUsage(
        order.id,
        allocation.id,
        action,
        allocation.planningRevision,
      )
      onOrderChange(next)
      toast.success(t("catalog.resourcePlanning.activeUse.toastUpdated"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("catalog.resourcePlanning.errors.usageActionFailed"),
      )
    } finally {
      setBusyAction(null)
    }
  }

  const canStart = order.status !== "Cancelled" && allocation.status === "Scheduled"
  const canFinish = allocation.status === "Running"
  const canRelease = allocation.status === "Cleaning"
  const showStart = order.status !== "Cancelled"

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-sm font-medium">{t("catalog.resourcePlanning.activeUse.title")}</h2>
      {order.status === "Cancelled" ? (
        <Alert variant="destructive">
          <AlertDescription>{t("catalog.resourcePlanning.activeUse.cancelledHint")}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-sm">
        <span className="text-muted-foreground">{t("catalog.resourcePlanning.activeUse.status")}: </span>
        {t(`catalog.resourcePlanning.allocationStatus.${allocation.status}`)}
      </p>
      <p className="text-sm tabular-nums">
        <span className="text-muted-foreground">{t("catalog.resourcePlanning.activeUse.workWindow")}: </span>
        {formatCatalogDate(allocation.plannedWorkStart, locale, timeZoneId)} –{" "}
        {formatCatalogDate(allocation.plannedWorkEnd, locale, timeZoneId)}
      </p>
      <div className="flex flex-wrap gap-2">
        {showStart ? (
          <LoadingButton
            type="button"
            loading={busyAction === "start"}
            disabled={!canAllocate || !canStart}
            onClick={() => void runUsage("start")}
          >
            {t("catalog.resourcePlanning.activeUse.start")}
          </LoadingButton>
        ) : null}
        <LoadingButton
          type="button"
          loading={busyAction === "work-finished"}
          disabled={!canAllocate || !canFinish}
          onClick={() => void runUsage("work-finished")}
        >
          {t("catalog.resourcePlanning.activeUse.workFinished")}
        </LoadingButton>
        <LoadingButton
          type="button"
          variant="outline"
          loading={busyAction === "release"}
          disabled={!canAllocate || !canRelease}
          onClick={() => void runUsage("release")}
        >
          {t("catalog.resourcePlanning.activeUse.release")}
        </LoadingButton>
      </div>
    </section>
  )
}
