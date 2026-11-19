import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Box } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { tenantKey } from "@/lib/queryKeys"
import {
  NOTES_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  initialValues,
  isValid,
  previewKey,
  previewView,
  toCreateRequest,
  toUpdateRequest,
  validate,
  valuesFromAllocation,
  type AllocationFormValues,
  type AllocationPrefill,
} from "../model/allocationForm"
import { canCloseAssets } from "../model/allocationActions"
import { describePlanningError, type DescribedError } from "../model/planningErrors"
import type { PlanningAllocation } from "../schemas/planningSchemas"
import { createAllocation, listPlanningAssets, previewAllocation, updateAllocation } from "../services/planningService"
import { PlanningConflictList, PlanningHoursNotice } from "./PlanningConflictList"

export type AllocationDialogTarget =
  | { mode: "create"; prefill: AllocationPrefill }
  | { mode: "edit"; allocation: PlanningAllocation }

type Props = {
  target: AllocationDialogTarget | null
  onOpenChange: (open: boolean) => void
  /** Called with the saved allocation, after the agenda cache was refreshed. */
  onSaved?: (allocation: PlanningAllocation) => void
}

export function AllocationDialog({ target, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so the form re-seeds from the target every time. */}
        {target && <AllocationForm target={target} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function AllocationForm({ target, onOpenChange, onSaved }: Omit<Props, "target"> & { target: AllocationDialogTarget }) {
  const { t } = useTranslation()
  const timeZone = useTenantTimeZone()
  const queryClient = useQueryClient()
  const { can, currentUser } = usePermissions()
  const tenantId = currentUser?.tenantId ?? null
  const editing = target.mode === "edit" ? target.allocation : null
  const zone = editing?.timeZoneId || timeZone
  const [values, setValues] = useState<AllocationFormValues>(() => (editing ? valuesFromAllocation(editing, zone) : initialValues(target.mode === "create" ? target.prefill : { date: "" })))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [failure, setFailure] = useState<DescribedError | null>(null)
  const set = <K extends keyof AllocationFormValues>(key: K, value: AllocationFormValues[K]) => {
    setFailure(null)
    setValues((current) => ({ ...current, [key]: value }))
  }

  const assets = useQuery({ queryKey: tenantKey("staff", tenantId, "planning-assets", "plannable"), queryFn: () => listPlanningAssets("true"), staleTime: 60_000 })
  const assetItems = (assets.data ?? []).map((asset) => ({ value: asset.id, label: asset.tag ? `${asset.name} (${asset.tag})` : asset.name }))
  // The asset of an allocation being edited may no longer be plannable; keep it selectable.
  if (editing && !assetItems.some((item) => item.value === editing.assetId)) assetItems.push({ value: editing.assetId, label: editing.assetName })

  const errors = validate(values, zone)
  const request = toCreateRequest(values, zone)
  const key = useDebounced(previewKey(request), 350)
  const preview = useQuery({
    queryKey: tenantKey("staff", tenantId, "planning-preview", key),
    queryFn: () => previewAllocation(request!),
    enabled: key !== null && request !== null && previewKey(request) === key,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const view = preview.data ? previewView(preview.data, editing?.id ?? null) : null
  const previewError = preview.error ? describePlanningError(preview.error) : null
  const checking = key !== previewKey(request) || preview.isFetching
  const blocked = view !== null && !view.feasible
  const canSubmit = isValid(errors) && !busy && !checking && !blocked

  async function submit() {
    setTouched(true)
    if (!isValid(errors) || busy || submitting.current || !request) return
    submitting.current = true
    setBusy(true)
    setFailure(null)
    try {
      const saved = editing
        ? await updateAllocation(editing.id, toUpdateRequest(values, zone, editing.version)!)
        : await createAllocation(request)
      await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "planning-agenda") }).catch(() => undefined)
      toast.success(t(editing ? "planning.dialog.updated" : "planning.dialog.created"))
      onSaved?.(saved)
      onOpenChange(false)
    } catch (cause) {
      const described = describePlanningError(cause)
      setFailure(described)
      if (described.code === "planning.version_conflict" || described.code === "planning.conflict") {
        await queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "planning-agenda") }).catch(() => undefined)
      }
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const showError = (name: keyof typeof errors) => touched && errors[name]
  const kindOptions = [
    { value: "Use" as const, label: t("planning.kind.Use") },
    { value: "Unavailable" as const, label: t("planning.kind.Unavailable") },
  ]
  const kindLocked = editing !== null
  const mayChooseKind = canCloseAssets(can) && !kindLocked
  const conflicts = failure?.conflicts.length ? failure.conflicts : view?.conflicts ?? []
  const hoursReason = failure?.hoursViolation ?? view?.hoursViolation ?? null

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(editing ? "planning.dialog.editTitle" : "planning.dialog.createTitle")}</DialogTitle>
        <DialogDescription>{t("planning.dialog.description")}</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="space-y-1.5">
          <Label htmlFor="planning-asset">{t("planning.dialog.asset")}</Label>
          <Select modal={false} disabled={kindLocked} value={values.assetId} onValueChange={(value) => { if (typeof value === "string") set("assetId", value) }} items={assetItems}>
            <SelectTrigger id="planning-asset" icon={Box} className="min-h-11 w-full" aria-invalid={showError("asset") ? true : undefined}>
              <SelectValue placeholder={t("planning.dialog.assetPlaceholder")} />
            </SelectTrigger>
            <SelectContent>{assetItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          {!assets.isPending && assetItems.length === 0 && <p className="text-xs text-muted-foreground">{t("planning.dialog.noAssets")}</p>}
          {showError("asset") && <p className="text-xs text-destructive">{t("planning.dialog.errors.asset")}</p>}
        </div>
        {mayChooseKind && (
          <div className="space-y-1.5">
            <Label id="planning-kind-label">{t("planning.dialog.kind")}</Label>
            <SegmentedControl label={t("planning.dialog.kind")} value={values.kind} options={kindOptions} onChange={(kind) => set("kind", kind)} />
            {values.kind === "Unavailable" && <p className="text-xs text-muted-foreground">{t("planning.dialog.unavailableHint")}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="planning-title">{values.kind === "Unavailable" ? t("planning.dialog.reason") : t("planning.dialog.title")}</Label>
          <Input id="planning-title" value={values.title} maxLength={TITLE_MAX_LENGTH} onChange={(event) => set("title", event.target.value)} aria-invalid={showError("title") ? true : undefined} />
          {showError("title") && <p className="text-xs text-destructive">{t("planning.dialog.errors.title")}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="planning-start-date">{t("planning.dialog.startDate")}</Label>
            <Input id="planning-start-date" type="date" value={values.startDate} onChange={(event) => set("startDate", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planning-start-time">{t("planning.dialog.startTime")}</Label>
            <Input id="planning-start-time" type="time" value={values.startTime} onChange={(event) => set("startTime", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planning-end-date">{t("planning.dialog.endDate")}</Label>
            <Input id="planning-end-date" type="date" value={values.endDate} onChange={(event) => set("endDate", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planning-end-time">{t("planning.dialog.endTime")}</Label>
            <Input id="planning-end-time" type="time" value={values.endTime} onChange={(event) => set("endTime", event.target.value)} />
          </div>
        </div>
        {(errors.start || errors.end) && <p className="text-xs text-destructive">{t("planning.dialog.errors.dates")}</p>}
        {errors.order && <p className="text-xs text-destructive">{t("planning.dialog.errors.order")}</p>}
        {errors.tooLong && <p className="text-xs text-destructive">{t("planning.dialog.errors.tooLong")}</p>}
        {values.kind === "Use" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="planning-prep">{t("planning.dialog.prep")}</Label>
              <Input id="planning-prep" inputMode="numeric" value={values.prepMinutes} placeholder="0" onChange={(event) => set("prepMinutes", event.target.value)} aria-invalid={errors.prep ? true : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planning-cleanup">{t("planning.dialog.cleanup")}</Label>
              <Input id="planning-cleanup" inputMode="numeric" value={values.cleanupMinutes} placeholder="0" onChange={(event) => set("cleanupMinutes", event.target.value)} aria-invalid={errors.cleanup ? true : undefined} />
            </div>
            {(errors.prep || errors.cleanup) && <p className="col-span-2 text-xs text-destructive">{t("planning.dialog.errors.buffer")}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="planning-notes">{t("planning.dialog.notes")}</Label>
          <Textarea id="planning-notes" rows={2} value={values.notes} maxLength={NOTES_MAX_LENGTH} onChange={(event) => set("notes", event.target.value)} />
        </div>

        <div aria-live="polite" className="space-y-2 text-sm" data-testid="planning-preview">
          {request && checking && !failure && <p className="text-muted-foreground">{t("planning.preview.checking")}</p>}
          {request && !checking && view?.feasible && !failure && <p className="text-success">{t("planning.preview.feasible")}</p>}
          {hoursReason && <PlanningHoursNotice reason={hoursReason} />}
          <PlanningConflictList conflicts={conflicts} timeZone={zone} />
          {previewError && !failure && <p className="text-xs text-muted-foreground">{t("planning.preview.unavailable")}</p>}
        </div>
        {failure && !failure.hoursViolation && failure.conflicts.length === 0 && <p role="alert" className="text-sm text-destructive">{failure.message}</p>}
        {failure && (failure.hoursViolation || failure.conflicts.length > 0) && <p role="alert" className="text-xs text-destructive">{failure.message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>{t("planning.dialog.cancel")}</Button>
          <Button type="submit" className="min-h-11" disabled={!canSubmit}>{busy ? t("planning.dialog.saving") : t(editing ? "planning.dialog.saveEdit" : "planning.dialog.save")}</Button>
        </DialogFooter>
      </form>
    </>
  )
}
