import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { tenantKey } from "@/lib/queryKeys"
import { allocationActions } from "../model/allocationActions"
import { describePlanningError, type DescribedError } from "../model/planningErrors"
import type { PlanningAllocation, UsageAction } from "../schemas/planningSchemas"
import { runAllocationUsage } from "../services/planningService"
import { PlanningConflictList } from "./PlanningConflictList"

type Props = {
  allocation: PlanningAllocation | null
  onOpenChange: (open: boolean) => void
  onEdit: (allocation: PlanningAllocation) => void
  /** The allocation after an action succeeded. */
  onChanged: (allocation: PlanningAllocation) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export function AllocationSheet({ allocation, onOpenChange, onEdit, onChanged }: Props) {
  return (
    <Sheet open={allocation !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 overflow-y-auto sm:w-[480px] sm:max-w-[480px]">
        {allocation && <SheetBody key={allocation.id} allocation={allocation} onOpenChange={onOpenChange} onEdit={onEdit} onChanged={onChanged} />}
      </SheetContent>
    </Sheet>
  )
}

function SheetBody({ allocation, onOpenChange, onEdit, onChanged }: Omit<Props, "allocation"> & { allocation: PlanningAllocation }) {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const queryClient = useQueryClient()
  const { can, currentUser } = usePermissions()
  const tenantId = currentUser?.tenantId ?? null
  const zone = allocation.timeZoneId || timeZone
  const locale = i18n.resolvedLanguage ?? i18n.language
  const actions = allocationActions(allocation, can, currentUser?.id ?? null)
  const [busy, setBusy] = useState<UsageAction | null>(null)
  const running = useRef(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  const [failure, setFailure] = useState<DescribedError | null>(null)

  const format = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(iso)) : "—"

  async function run(action: UsageAction) {
    if (running.current) return
    running.current = true
    setBusy(action)
    setFailure(null)
    try {
      const updated = await runAllocationUsage(allocation.id, { action, expectedVersion: allocation.version, reason: action === "cancel" ? reason.trim() || null : null })
      await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "planning-agenda") }).catch(() => undefined)
      toast.success(t(`planning.sheet.done.${action}`))
      setCancelling(false)
      onChanged(updated)
      if (action === "cancel") onOpenChange(false)
    } catch (cause) {
      setFailure(describePlanningError(cause))
      // A stale version or state means the row moved: reload the agenda so the sheet shows the truth.
      await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "planning-agenda") }).catch(() => undefined)
    } finally {
      running.current = false
      setBusy(null)
    }
  }

  const tone = allocation.status === "Cancelled" || allocation.status === "Released" ? "outline" : allocation.status === "Running" ? "default" : "secondary"
  const hasActions = actions.start || actions.workFinished || actions.release || actions.cancel || actions.edit

  return (
    <>
      <SheetHeader>
        <SheetTitle>{allocation.title || t(`planning.kind.${allocation.kind || "Use"}`)}</SheetTitle>
        <SheetDescription>{allocation.assetName}</SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant={tone}>{t(`planning.status.${allocation.status}`)}</Badge>
          <Badge variant="outline">{t(`planning.kind.${allocation.kind || "Use"}`)}</Badge>
          {allocation.isOverdue && <Badge variant="destructive">{t("planning.flags.overdue")}</Badge>}
          {allocation.isExpired && <Badge variant="outline">{t("planning.flags.expired")}</Badge>}
        </div>
      </SheetHeader>
      <div className="flex-1 space-y-3 px-4 pb-4">
        {allocation.isOverdue && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{t(allocation.status === "Cleaning" ? "planning.sheet.overdueCleaning" : "planning.sheet.overdueRunning")}</p>}
        {allocation.isExpired && <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t("planning.sheet.expiredNote")}</p>}
        <dl className="divide-y">
          <Row label={t("planning.sheet.work")}>{format(allocation.plannedWorkStart)} – {format(allocation.plannedWorkEnd)}</Row>
          <Row label={t("planning.sheet.occupied")}>{format(allocation.occupiedStart)} – {format(allocation.occupiedEnd)}</Row>
          {allocation.actualStartAt && <Row label={t("planning.sheet.startedAt")}>{format(allocation.actualStartAt)}</Row>}
          {allocation.actualWorkFinishedAt && <Row label={t("planning.sheet.finishedAt")}>{format(allocation.actualWorkFinishedAt)}</Row>}
          {allocation.actualReleaseAt && <Row label={t("planning.sheet.releasedAt")}>{format(allocation.actualReleaseAt)}</Row>}
          {allocation.referenceLabel && <Row label={t("planning.sheet.reference")}>{allocation.referenceLabel}</Row>}
          {allocation.notes && <Row label={t("planning.sheet.notes")}>{allocation.notes}</Row>}
          {allocation.cancelReason && <Row label={t("planning.sheet.cancelReason")}>{allocation.cancelReason}</Row>}
        </dl>
        {actions.orderWorkflow && <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="planning-order-workflow">{t("planning.sheet.orderWorkflow", { label: allocation.referenceLabel || t("planning.sheet.theOrder") })}</p>}
        {cancelling && (
          <div className="space-y-1.5">
            <Label htmlFor="planning-cancel-reason">{t("planning.sheet.cancelReasonLabel")}</Label>
            <Textarea id="planning-cancel-reason" rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        )}
        {failure && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{failure.message}</p>
            <PlanningConflictList conflicts={failure.conflicts} timeZone={zone} />
          </div>
        )}
      </div>
      {hasActions && (
        <SheetFooter className="flex-row flex-wrap gap-2 border-t">
          {actions.start && <Button className="min-h-11" disabled={busy !== null} onClick={() => void run("start")}>{busy === "start" ? t("planning.sheet.working") : t("planning.sheet.actions.start")}</Button>}
          {actions.workFinished && <Button className="min-h-11" disabled={busy !== null} onClick={() => void run("work-finished")}>{busy === "work-finished" ? t("planning.sheet.working") : t("planning.sheet.actions.workFinished")}</Button>}
          {actions.release && <Button className="min-h-11" disabled={busy !== null} onClick={() => void run("release")}>{busy === "release" ? t("planning.sheet.working") : t("planning.sheet.actions.release")}</Button>}
          {actions.edit && !cancelling && <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => onEdit(allocation)}>{t("planning.sheet.actions.edit")}</Button>}
          {actions.cancel && !cancelling && <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setCancelling(true)}>{t("planning.sheet.actions.cancel")}</Button>}
          {actions.cancel && cancelling && (
            <>
              <Button variant="destructive" className="min-h-11" disabled={busy !== null} onClick={() => void run("cancel")}>{busy === "cancel" ? t("planning.sheet.working") : t("planning.sheet.actions.confirmCancel")}</Button>
              <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setCancelling(false)}>{t("planning.sheet.actions.keep")}</Button>
            </>
          )}
        </SheetFooter>
      )}
    </>
  )
}
