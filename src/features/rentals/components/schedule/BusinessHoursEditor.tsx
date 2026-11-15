import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { SaveBar } from "@/components/layout/SaveBar"
import { Time24Input } from "@/components/Time24Input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_CLOSE_TIME,
  DEFAULT_OPEN_TIME,
  SLOT_PRESETS,
  WEEK_ORDER,
  buildBusinessHoursPlan,
  deriveBusinessHours,
  draftProblem,
  isDraftDirty,
  isRowComplete,
  summarizeRemovals,
  type BusinessHoursDraft,
  type BusinessHoursPlan,
  type HoursRow,
} from "@/features/rentals/components/schedule/businessHoursModel"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { scheduleChipClassName } from "@/features/rentals/components/schedule/scheduleChipClassName"
import type {
  AdminRentalAsset,
  DayOfWeekName,
  ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"

export type BusinessHoursSaveResult = { ok: boolean; errors: string[] }

type BusinessHoursEditorProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  /** Active templates of the selected resources, every weekday. */
  scheduleTemplates: readonly ScheduleTemplate[]
  /** Occupancy kind the new hours are created with. */
  openKindId: string
  loadingTemplates: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onSave: (plan: BusinessHoursPlan) => Promise<BusinessHoursSaveResult>
  onDirtyChange?: (dirty: boolean) => void
}

function templatesSignature(templates: readonly ScheduleTemplate[]): string {
  return templates
    .map((template) => `${template.id}:${template.dayOfWeek}:${template.startTime}:${template.endTime}`)
    .sort()
    .join("|")
}

export function BusinessHoursEditor(props: BusinessHoursEditorProps) {
  const { t } = useTranslation()
  const { assets, selectedRentalAssetIds, loadingTemplates, busy, readOnly } = props
  const [scope, setScope] = useState<"all" | "some">(() =>
    assets.length > 0 && selectedRentalAssetIds.length === assets.length ? "all" : "some",
  )
  const [errors, setErrors] = useState<string[]>([])
  const showScope = assets.length > 1

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="business-hours-title">
      <header className="space-y-1">
        <h2 id="business-hours-title" className="text-base font-semibold">
          {t("rentals.schedule.hours.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("rentals.schedule.hours.description")}</p>
      </header>

      {showScope ? (
        <fieldset className="space-y-3" disabled={busy || readOnly}>
          <legend className="mb-2 text-sm font-medium">{t("rentals.schedule.hours.scope")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("rentals.schedule.hours.scope")}>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "all"}
              className={scheduleChipClassName(scope === "all")}
              onClick={() => {
                setScope("all")
                props.onSelectedRentalAssetIdsChange(assets.map((asset) => asset.id))
              }}
            >
              {t("rentals.schedule.hours.allResources")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "some"}
              className={scheduleChipClassName(scope === "some")}
              onClick={() => setScope("some")}
            >
              {t("rentals.schedule.hours.someResources")}
            </button>
          </div>
          {scope === "some" ? (
            <RentableMultiSelect
              assets={assets}
              selectedIds={selectedRentalAssetIds}
              onChange={props.onSelectedRentalAssetIdsChange}
              disabled={busy || readOnly}
            />
          ) : null}
        </fieldset>
      ) : null}

      {errors.length > 0 ? (
        <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">{t("rentals.schedule.hours.errorsTitle")}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((message, index) => (
              <li key={`${index}-${message}`}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {selectedRentalAssetIds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("rentals.schedule.hours.scopeNone")}
        </p>
      ) : loadingTemplates ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : (
        <HoursForm {...props} onErrors={setErrors} />
      )}
    </section>
  )
}

function HoursForm({
  assets,
  selectedRentalAssetIds,
  scheduleTemplates,
  openKindId,
  busy,
  busyAction,
  readOnly,
  onSave,
  onDirtyChange,
  onErrors,
}: BusinessHoursEditorProps & { onErrors: (errors: string[]) => void }) {
  const { t } = useTranslation()
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )
  const baseline = useMemo(
    () => deriveBusinessHours(selectedAssets, scheduleTemplates),
    [selectedAssets, scheduleTemplates],
  )
  const hardKey = [...selectedRentalAssetIds].sort().join(",")
  const softKey = `${templatesSignature(scheduleTemplates)}#${selectedAssets
    .map((asset) => `${asset.id}:${asset.schedulePolicy ?? ""}:${asset.openTime ?? ""}:${asset.closeTime ?? ""}`)
    .sort()
    .join("|")}`

  const [draft, setDraft] = useState<BusinessHoursDraft>(baseline)
  const [customSlot, setCustomSlot] = useState(false)
  const [synced, setSynced] = useState({ hardKey, softKey })
  const [resetAfterSave, setResetAfterSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmPlan, setConfirmPlan] = useState<BusinessHoursPlan | null>(null)
  const dirty = isDraftDirty(draft)

  if (synced.hardKey !== hardKey || synced.softKey !== softKey) {
    const hardChange = synced.hardKey !== hardKey
    setSynced({ hardKey, softKey })
    if (hardChange || resetAfterSave || !dirty) {
      setDraft(baseline)
      setCustomSlot(false)
      setResetAfterSave(false)
    }
  }

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const locked = busy || readOnly || saving
  const problem = draftProblem(draft)
  const livePlan = useMemo(
    () => (problem ? null : buildBusinessHoursPlan(draft, selectedRentalAssetIds, scheduleTemplates, openKindId)),
    [problem, draft, selectedRentalAssetIds, scheduleTemplates, openKindId],
  )
  const conflictDays = livePlan?.conflicts ?? []
  const nothingToApply = Boolean(livePlan) && livePlan!.groups.length === 0 && livePlan!.removals.length === 0

  function dayLabel(day: DayOfWeekName) {
    return t(`rentals.schedule.days.${day}`)
  }

  function patchRow(day: DayOfWeekName, patch: Partial<HoursRow>) {
    setResetAfterSave(false)
    setDraft((current) => {
      const before = baseline.days[day]
      const next = { ...current.days[day], ...patch }
      const same =
        !before.mixed &&
        before.open === next.open &&
        (!next.open || (before.openTime === next.openTime && before.closeTime === next.closeTime))
      return { ...current, days: { ...current.days, [day]: { ...next, touched: !same } } }
    })
  }

  function toggleDay(day: DayOfWeekName, open: boolean) {
    const row = draft.days[day]
    patchRow(day, {
      open,
      openTime: open && !row.openTime ? DEFAULT_OPEN_TIME : row.openTime,
      closeTime: open && !row.closeTime ? DEFAULT_CLOSE_TIME : row.closeTime,
    })
  }

  const copySource = WEEK_ORDER.map((day) => draft.days[day]).find((row) => row.open && isRowComplete(row))

  function copyToAll() {
    if (!copySource) return
    setResetAfterSave(false)
    setDraft((current) => {
      const days = { ...current.days }
      for (const day of WEEK_ORDER) {
        const before = baseline.days[day]
        const same =
          !before.mixed &&
          before.open &&
          before.openTime === copySource.openTime &&
          before.closeTime === copySource.closeTime
        days[day] = {
          ...days[day],
          open: true,
          openTime: copySource.openTime,
          closeTime: copySource.closeTime,
          touched: !same,
        }
      }
      return { ...current, days }
    })
  }

  function setSlot(minutes: number | null, custom: boolean) {
    setResetAfterSave(false)
    setCustomSlot(custom)
    setDraft((current) => ({
      ...current,
      slotMinutes: minutes,
      slotTouched: minutes !== baseline.slotMinutes || baseline.slotMixed,
    }))
  }

  async function run(plan: BusinessHoursPlan) {
    setSaving(true)
    onErrors([])
    // Reload from the server once the save changes the stored hours, so a partial failure shows what really saved.
    setResetAfterSave(true)
    try {
      const result = await onSave(plan)
      onErrors(result.errors)
    } finally {
      setSaving(false)
    }
  }

  function requestSave() {
    const plan = buildBusinessHoursPlan(draft, selectedRentalAssetIds, scheduleTemplates, openKindId)
    if (plan.removals.length > 0) {
      setConfirmPlan(plan)
      return
    }
    void run(plan)
  }

  const slotIsCustom = customSlot || (draft.slotMinutes !== null && !(SLOT_PRESETS as readonly number[]).includes(draft.slotMinutes))
  const removalLines = confirmPlan ? summarizeRemovals(confirmPlan.removals) : []

  return (
    <div className="space-y-5">
      {selectedAssets.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          {t("rentals.schedule.hours.appliesTo", { count: selectedAssets.length })}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border" aria-label={t("rentals.schedule.hours.title")}>
        {WEEK_ORDER.map((day) => {
          const row = draft.days[day]
          const showMixed = row.mixed && !row.touched
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <span className="w-24 shrink-0 text-sm font-medium">{dayLabel(day)}</span>
              <div className="flex min-h-11 items-center gap-2 text-sm">
                <Switch
                  size="sm"
                  checked={row.open}
                  disabled={locked}
                  aria-label={`${t("rentals.schedule.hours.open")} — ${dayLabel(day)}`}
                  onCheckedChange={(checked) => toggleDay(day, checked)}
                />
                <span className="w-14 text-muted-foreground">
                  {row.open ? t("rentals.schedule.hours.open") : t("rentals.schedule.hours.closed")}
                </span>
              </div>
              {showMixed ? (
                <span className="text-xs text-muted-foreground">{t("rentals.schedule.hours.differs")}</span>
              ) : row.open ? (
                <div className="flex items-center gap-2">
                  <Time24Input
                    className="w-24"
                    value={row.openTime}
                    disabled={locked}
                    aria-label={`${dayLabel(day)}: ${t("rentals.schedule.hours.opens")}`}
                    onValueChange={(next) => patchRow(day, { openTime: next })}
                  />
                  <span aria-hidden className="text-muted-foreground">–</span>
                  <Time24Input
                    className="w-24"
                    value={row.closeTime}
                    disabled={locked}
                    aria-label={`${dayLabel(day)}: ${t("rentals.schedule.hours.closes")}`}
                    onValueChange={(next) => patchRow(day, { closeTime: next })}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div>
        <Button type="button" variant="outline" size="sm" disabled={locked || !copySource} onClick={copyToAll}>
          {t("rentals.schedule.hours.copyToAll")}
        </Button>
      </div>

      <fieldset className="space-y-2" disabled={locked}>
        <legend className="text-sm font-medium">{t("rentals.schedule.hours.slotLabel")}</legend>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("rentals.schedule.hours.slotLabel")}>
          {SLOT_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={!slotIsCustom && draft.slotMinutes === minutes}
              className={scheduleChipClassName(!slotIsCustom && draft.slotMinutes === minutes)}
              onClick={() => setSlot(minutes, false)}
            >
              {t("rentals.schedule.hours.slotUnit", { count: minutes })}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={slotIsCustom}
            className={scheduleChipClassName(slotIsCustom)}
            onClick={() => setSlot(draft.slotMinutes, true)}
          >
            {t("rentals.schedule.hours.slotCustom")}
          </button>
          {slotIsCustom ? (
            <Input
              type="number"
              min={1}
              step={5}
              className="w-24"
              aria-label={t("rentals.schedule.hours.slotMinutes")}
              value={draft.slotMinutes ?? ""}
              onChange={(event) => {
                const raw = event.target.value
                setSlot(raw === "" ? null : Number(raw), true)
              }}
            />
          ) : null}
        </div>
        {draft.slotMixed && !draft.slotTouched ? (
          <p className="text-xs text-muted-foreground">{t("rentals.schedule.hours.slotDiffers")}</p>
        ) : null}
      </fieldset>

      {dirty && conflictDays.length > 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("rentals.schedule.hours.conflict", { days: conflictDays.map(dayLabel).join(", ") })}
        </p>
      ) : null}

      {dirty && problem ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`rentals.schedule.hours.problem.${problem}`)}
        </p>
      ) : null}

      <SaveBar
        dirty={dirty}
        saving={saving || (busy && busyAction === "weeklyRule")}
        saveLabel={t("rentals.schedule.hours.save")}
        saveDisabled={Boolean(problem) || nothingToApply || readOnly || (busy && !saving)}
        onSave={requestSave}
        onDiscard={() => {
          setDraft(baseline)
          setCustomSlot(false)
        }}
      />

      <Dialog open={confirmPlan !== null} onOpenChange={(next) => { if (!next) setConfirmPlan(null) }}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t("rentals.schedule.hours.confirm.title")}</DialogTitle>
            <DialogDescription>{t("rentals.schedule.hours.confirm.description")}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {removalLines.map((line) => (
              <li key={`${line.day}-${line.reason}`}>
                {t(
                  `rentals.schedule.hours.confirm.remove${line.reason === "closed" ? "Closed" : line.reason === "outside" ? "Outside" : "Replace"}`,
                  { day: dayLabel(line.day), count: line.count, resources: line.resources },
                )}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmPlan(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                const plan = confirmPlan
                setConfirmPlan(null)
                if (plan) void run(plan)
              }}
            >
              {t("rentals.schedule.hours.confirm.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
