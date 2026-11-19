import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Time24Input } from "@/components/Time24Input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { tenantKey } from "@/lib/queryKeys"
import {
  WEEK_DAYS,
  addWindow,
  copyToWeekdays,
  draftFromProfile,
  policyNeedsHours,
  removeWindow,
  setDayOpen,
  toRequest,
  updateWindow,
  validateDraft,
  type AvailabilityDraft,
  type WeekDay,
} from "../model/availabilityForm"
import { describePlanningError } from "../model/planningErrors"
import { hoursPolicies, type AssetProfile, type HoursPolicy } from "../schemas/planningSchemas"
import { getAssetProfile, putAssetProfile } from "../services/planningService"

type Props = {
  assetId: string | null
  assetName: string
  onOpenChange: (open: boolean) => void
  onSaved?: (profile: AssetProfile) => void
}

export function AssetAvailabilityDialog({ assetId, assetName, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={assetId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {/* Mounted only while open, so the form re-seeds from the profile every time. */}
        {assetId && <AvailabilityBody assetId={assetId} assetName={assetName} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function Header({ assetName }: { assetName: string }) {
  const { t } = useTranslation()
  return (
    <DialogHeader>
      <DialogTitle>{t("planning.availability.title")}</DialogTitle>
      <DialogDescription className="[overflow-wrap:anywhere]">{assetName ? t("planning.availability.subtitle", { name: assetName }) : t("planning.availability.subtitleNoName")}</DialogDescription>
    </DialogHeader>
  )
}

function AvailabilityBody({ assetId, assetName, onOpenChange, onSaved }: Omit<Props, "assetId"> & { assetId: string }) {
  const { t } = useTranslation()
  const { currentUser } = usePermissions()
  const tenantId = currentUser?.tenantId ?? null
  const profile = useQuery({
    queryKey: tenantKey("staff", tenantId, "planning-profile", assetId),
    queryFn: () => getAssetProfile(assetId),
    gcTime: 0,
  })

  if (profile.isPending) {
    return (
      <>
        <Header assetName={assetName} />
        <div role="status" aria-label={t("planning.availability.loading")} className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </>
    )
  }
  if (profile.error || !profile.data) {
    return (
      <>
        <Header assetName={assetName} />
        <p role="alert" className="text-sm text-destructive">{describePlanningError(profile.error).message}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void profile.refetch()}>{t("planning.availability.retry")}</Button>
        </DialogFooter>
      </>
    )
  }
  return <AvailabilityForm assetId={assetId} assetName={assetName} profile={profile.data} onOpenChange={onOpenChange} onSaved={onSaved} />
}

function RentalNotice({ assetName, onClose }: { assetName: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <Header assetName={assetName} />
      <div role="note" data-testid="availability-rental-notice" className="space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <p className="font-medium">{t("planning.availability.rental.title")}</p>
        <p className="text-muted-foreground">{t("planning.availability.rental.description")}</p>
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>{t("planning.availability.close")}</Button>
      </DialogFooter>
    </>
  )
}

function AvailabilityForm({ assetId, assetName, profile, onOpenChange, onSaved }: Omit<Props, "assetId"> & { assetId: string; profile: AssetProfile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { currentUser } = usePermissions()
  const tenantId = currentUser?.tenantId ?? null
  const [draft, setDraft] = useState<AvailabilityDraft>(() => draftFromProfile(profile))
  const [touched, setTouched] = useState(false)
  const [rentalBlocked, setRentalBlocked] = useState(profile.isRentalBacked)
  const [serverError, setServerError] = useState<string | null>(null)
  const validation = validateDraft(draft)
  const showHours = policyNeedsHours(draft.hoursPolicy)

  const change = (next: AvailabilityDraft) => { setDraft(next); setServerError(null) }
  const close = () => onOpenChange(false)

  const save = useMutation({
    mutationFn: () => putAssetProfile(assetId, toRequest(draft)),
    onSuccess: async (saved) => {
      // The agenda shades closed hours from the profile, so reload it (and the resource list) before closing.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "planning-agenda") }),
        queryClient.invalidateQueries({ queryKey: tenantKey("staff", tenantId, "planning-assets") }),
      ]).catch(() => undefined)
      toast.success(t("planning.availability.saved"))
      onSaved?.(saved)
      close()
    },
    onError: (error) => {
      const described = describePlanningError(error)
      if (described.code === "planning.rental_schedule_authority") setRentalBlocked(true)
      else if (described.code === "planning.version_conflict") setServerError(t("planning.availability.versionConflict"))
      else setServerError(described.message)
    },
  })

  if (rentalBlocked) return <RentalNotice assetName={assetName} onClose={close} />

  const submit = () => {
    setTouched(true)
    if (validation.valid && !save.isPending) save.mutate()
  }
  const problemText = (problem: string) => t(`planning.availability.problems.${problem}`)
  const bufferInvalid = touched && validation.draft.includes("invalidBuffer")

  return (
    <>
      <Header assetName={assetName} />
      <form className="min-w-0 space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); submit() }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="availability-plannable">{t("planning.availability.plannable")}</Label>
            <p className="text-xs text-muted-foreground">{t("planning.availability.plannableHint")}</p>
          </div>
          <Switch id="availability-plannable" checked={draft.isPlannable} onCheckedChange={(isPlannable) => change({ ...draft, isPlannable })} />
        </div>

        {draft.isPlannable && (
          <>
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-1 text-sm font-medium">{t("planning.availability.policy")}</legend>
              {hoursPolicies.map((policy: HoursPolicy) => (
                <Label key={policy} htmlFor={`availability-policy-${policy}`} className="flex cursor-pointer items-start leading-normal font-normal gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    id={`availability-policy-${policy}`}
                    type="radio"
                    name="availability-policy"
                    className="mt-1 size-4 shrink-0"
                    checked={draft.hoursPolicy === policy}
                    onChange={() => change({ ...draft, hoursPolicy: policy })}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t(`planning.availability.policies.${policy}.label`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`planning.availability.policies.${policy}.description`)}</span>
                  </span>
                </Label>
              ))}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="availability-capacity">{t("planning.availability.capacity")}</Label>
                {/* One use at a time for now: shown, not editable. */}
                <Input id="availability-capacity" value={draft.capacity} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="availability-prep">{t("planning.availability.prep")}</Label>
                <Input id="availability-prep" inputMode="numeric" value={draft.prepMinutes} aria-invalid={bufferInvalid ? true : undefined} onChange={(event) => change({ ...draft, prepMinutes: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="availability-cleanup">{t("planning.availability.cleanup")}</Label>
                <Input id="availability-cleanup" inputMode="numeric" value={draft.cleanupMinutes} aria-invalid={bufferInvalid ? true : undefined} onChange={(event) => change({ ...draft, cleanupMinutes: event.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">{t("planning.availability.bufferHint")}</p>
              {bufferInvalid && <p role="alert" className="text-xs text-destructive sm:col-span-3">{problemText("invalidBuffer")}</p>}
            </div>

            {showHours ? (
              <section className="min-w-0 space-y-3" aria-labelledby="availability-hours">
                <div>
                  <h3 id="availability-hours" className="text-sm font-medium">{t("planning.availability.hours")}</h3>
                  <p className="text-xs text-muted-foreground">{t("planning.availability.hoursHint")}</p>
                </div>
                {WEEK_DAYS.map((day: WeekDay) => {
                  const windows = draft.days[day].windows
                  const dayName = t(`planning.availability.days.${day}`)
                  return (
                    <div key={day} data-testid={`availability-day-${day}`} className="min-w-0 space-y-2 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Switch size="sm" checked={windows.length > 0} aria-label={t("planning.availability.dayOpen", { day: dayName })} onCheckedChange={(open) => change(setDayOpen(draft, day, open))} />
                          <span className="text-sm font-medium">{dayName}</span>
                          {windows.length === 0 && <span className="text-xs text-muted-foreground">{t("planning.availability.closedDay")}</span>}
                        </div>
                        {windows.length > 0 && (
                          <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => change(copyToWeekdays(draft, day))} aria-label={t("planning.availability.copyToWeekdaysFrom", { day: dayName })}>
                            {t("planning.availability.copyToWeekdays")}
                          </Button>
                        )}
                      </div>
                      {windows.map((window, index) => {
                        const problem = validation.windows[window.id]
                        const label = windows.length > 1 ? `${dayName} ${index + 1}` : dayName
                        return (
                          <div key={window.id} className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Time24Input className="w-24" aria-label={t("planning.availability.openAt", { day: label })} value={window.openTime} aria-invalid={problem ? true : undefined} onValueChange={(openTime) => change(updateWindow(draft, day, window.id, { openTime }))} />
                              <span aria-hidden className="text-muted-foreground">–</span>
                              <Time24Input className="w-24" aria-label={t("planning.availability.closeAt", { day: label })} value={window.closeTime} aria-invalid={problem ? true : undefined} onValueChange={(closeTime) => change(updateWindow(draft, day, window.id, { closeTime }))} />
                              <Button type="button" variant="ghost" size="icon" className="min-h-9 min-w-9" aria-label={t("planning.availability.removeWindow", { day: label })} onClick={() => change(removeWindow(draft, day, window.id))}>
                                <Trash2 className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                              </Button>
                            </div>
                            {problem && <p role="alert" className="text-xs text-destructive">{problemText(problem)}</p>}
                          </div>
                        )
                      })}
                      {windows.length > 0 && (
                        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => change(addWindow(draft, day))} aria-label={t("planning.availability.addWindowTo", { day: dayName })}>
                          <Plus className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                          {t("planning.availability.addWindow")}
                        </Button>
                      )}
                    </div>
                  )
                })}
                {touched && validation.draft.includes("hoursRequired") && <p role="alert" className="text-xs text-destructive">{problemText("hoursRequired")}</p>}
              </section>
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{t("planning.availability.anytimeNote")}</p>
            )}
          </>
        )}

        {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>{t("planning.availability.cancel")}</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? t("planning.availability.saving") : t("planning.availability.save")}</Button>
        </DialogFooter>
      </form>
    </>
  )
}
