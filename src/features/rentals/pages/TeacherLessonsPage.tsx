import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { compareSlotsByStartTime, isUnreservedAvailable, useTeacherLessons } from "@/features/rentals/hooks/useTeacherLessons"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import {
  explainAvailableTime,
  type AvailableTimeReason,
} from "@/features/rentals/lib/availableTimeState"
import { isPastTenantSlotStart, withoutPastTenantSlots } from "@/features/rentals/lib/offerableSlot"
import i18n from "@/lib/i18n"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function readLessonDateFromLocation(today: string): {
  date: string
  adjustedFromPast: boolean
} {
  if (typeof window === "undefined") {
    return { date: today, adjustedFromPast: false }
  }

  const value = new URLSearchParams(window.location.search).get("date")
  if (!value || !ISO_DATE.test(value)) {
    return { date: today, adjustedFromPast: false }
  }

  if (value < today) {
    return { date: today, adjustedFromPast: true }
  }

  return { date: value, adjustedFromPast: false }
}

type PendingRemoval = {
  id: string
  startTime: string
  endTime: string
}

export function TeacherLessonsPage() {
  const { t } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const { assets, day, dayStatus, loading, busy, loadDay, create, remove } = useTeacherLessons(t)
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)
  const removalInFlight = useRef(false)
  const openSlots = useMemo(
    () => (day?.slots.filter((slot) => slot.occupancyKindKey === "open" && isUnreservedAvailable(slot)) ?? [])
      .slice()
      .sort(compareSlotsByStartTime),
    [day],
  )
  const lessons = useMemo(
    () => day?.slots.filter((slot) => slot.occupancyKindKey === "lesson" && isUnreservedAvailable(slot)) ?? [],
    [day],
  )
  const schema = useMemo(() => {
    const slotRequired = t("rentals.teacherLessons.slotRequired")
    return z.object({
      assetId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slotKey: z.string({ error: slotRequired })
        .min(1, { error: slotRequired })
        .refine((value) => !value || openSlots.some((slot) => slotKeyFor(slot) === value), {
          message: t("rentals.teacherLessons.slotUnavailable"),
        }),
      label: z.string().max(120),
    })
  }, [openSlots, t])
  type FormValues = z.infer<typeof schema>
  const [dateRequest] = useState(() =>
    readLessonDateFromLocation(todayIsoDate(timeZoneId)),
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { assetId: "", date: dateRequest.date, slotKey: "", label: "" },
  })
  const { clearErrors, getValues, setError, setValue } = form
  const assetId = useWatch({ control: form.control, name: "assetId" })
  const selectedAssetId = assets.some((asset) => asset.id === assetId)
    ? assetId
    : (assets[0]?.id ?? "")
  const resourcesPending = loading && assets.length === 0
  const date = useWatch({ control: form.control, name: "date" })
  const slotKey = useWatch({ control: form.control, name: "slotKey" })
  const label = useWatch({ control: form.control, name: "label" })
  const available = useMemo(() => {
    if (!date || !ISO_DATE.test(date)) {
      return openSlots
    }
    return withoutPastTenantSlots(date, openSlots, timeZoneId)
  }, [date, openSlots, timeZoneId])
  const pastSlotsHidden = available.length < openSlots.length
  const values = { assetId: selectedAssetId, date, slotKey, label }
  const isValid = schema.safeParse(values).success
    && (!slotKey || available.some((slot) => slotKeyFor(slot) === slotKey))
  const timeReason = explainAvailableTime({
    resourcesPending,
    hasResource: selectedAssetId.length > 0,
    dayStatus,
    slots: dayStatus === "ready" ? (day?.slots ?? []) : null,
    openCount: openSlots.length,
    offerableCount: available.length,
  })
  const timePlaceholder = t(availableTimePlaceholderKey(timeReason, resourcesPending))
  const timeSelectable = timeReason === "ready" && available.length > 0

  useEffect(() => {
    if (!selectedAssetId || selectedAssetId === assetId) return
    setValue("assetId", selectedAssetId, { shouldValidate: false })
  }, [assetId, selectedAssetId, setValue])

  useEffect(() => {
    if (!date || !ISO_DATE.test(date)) return
    const url = new URL(window.location.href)
    if (date === todayIsoDate(timeZoneId)) url.searchParams.delete("date")
    else url.searchParams.set("date", date)
    const next = `${url.pathname}${url.search}${url.hash}`
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (current !== next) window.history.replaceState(window.history.state, "", next)
  }, [date, timeZoneId])

  useEffect(() => {
    if (!selectedAssetId || !date) return
    const selectedBeforeRefresh = getValues("slotKey")
    void loadDay(selectedAssetId, date).then((result) => {
      if (!result) return
      const selected = getValues("slotKey") || selectedBeforeRefresh
      const selectedStart = selected?.split("|")[0] ?? ""
      const stillOffered = Boolean(selected)
        && !isPastTenantSlotStart(date, selectedStart, timeZoneId)
        && result.slots.some((slot) => slotKeyFor(slot) === selected && slot.occupancyKindKey === "open" && isUnreservedAvailable(slot))
      if (!selected || stillOffered) return
      const message = i18n.t("rentals.teacherLessons.slotUnavailable")
      setValue("slotKey", "", { shouldValidate: false })
      setError("slotKey", { type: "validate", message })
      toast.error(message)
    })
  }, [date, getValues, loadDay, selectedAssetId, setError, setValue, timeZoneId])

  async function onSubmit(valuesToSubmit: FormValues) {
    const slot = available.find((item) => slotKeyFor(item) === valuesToSubmit.slotKey)
    if (!slot) {
      const message = t("rentals.teacherLessons.slotUnavailable")
      setError("slotKey", { type: "validate", message })
      toast.error(message)
      return
    }
    try {
      const assetForSubmit = selectedAssetId || valuesToSubmit.assetId
      await create({ assetId: assetForSubmit, date: valuesToSubmit.date, slot, label: valuesToSubmit.label })
      setValue("label", "")
      setValue("slotKey", "", { shouldValidate: false })
      clearErrors("slotKey")
      await loadDay(assetForSubmit, valuesToSubmit.date)
    } catch {
      // The hook reports API errors and keeps the form values for correction.
    }
  }

  async function confirmRemoval() {
    if (!pendingRemoval || !selectedAssetId || !date || removalInFlight.current) return
    removalInFlight.current = true
    try {
      await remove(
        selectedAssetId,
        date,
        pendingRemoval.startTime,
        pendingRemoval.endTime,
        pendingRemoval.id,
      )
      setPendingRemoval(null)
      await loadDay(selectedAssetId, date)
    } catch {
      // The hook reports API errors and keeps the dialog open so the user can retry.
    } finally {
      removalInFlight.current = false
    }
  }

  const lessonsPending = !resourcesPending && (
    dayStatus === "loading"
    || (dayStatus === "idle" && selectedAssetId.length > 0)
  )

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6" data-testid="teacher-lessons-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("rentals.teacherLessons.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rentals.teacherLessons.description")}</p>
        {dateRequest.adjustedFromPast && date === todayIsoDate(timeZoneId) ? (
          <p role="status" className="text-sm text-foreground">
            {t("rentals.teacherLessons.pastDateAdjusted")}
          </p>
        ) : null}
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <FormField control={form.control} name="assetId" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("rentals.teacherLessons.court")}</FormLabel>
              <Select value={selectedAssetId.length > 0 ? selectedAssetId : null} onValueChange={field.onChange} items={assets.map((asset) => ({ value: asset.id, label: asset.name }))} disabled={resourcesPending || busy || assets.length === 0}>
                <FormControl><SelectTrigger aria-label={t("rentals.teacherLessons.court")}><SelectValue placeholder={resourcesPending ? t("rentals.teacherLessons.loadingResources") : t("rentals.teacherLessons.court")} /></SelectTrigger></FormControl>
                <SelectContent>{assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("rentals.teacherLessons.date")}</FormLabel>
              <FormControl><Input {...field} aria-label={t("rentals.teacherLessons.date")} type="date" min={todayIsoDate(timeZoneId)} disabled={busy} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="slotKey" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("rentals.teacherLessons.availableTime")}</FormLabel>
              <Select
                value={field.value ? field.value : null}
                onValueChange={(value) => {
                  if (typeof value !== "string" || value.length === 0) {
                    setValue("slotKey", "", { shouldValidate: false })
                    return
                  }
                  field.onChange(value)
                }}
                items={available.map((slot) => ({ value: slotKeyFor(slot), label: `${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}` }))}
                disabled={busy || resourcesPending || !timeSelectable}
              >
                <FormControl><SelectTrigger aria-describedby={timeReason === "ready" && !pastSlotsHidden ? undefined : "available-time-state"} aria-label={t("rentals.teacherLessons.availableTime")}><SelectValue placeholder={timePlaceholder} /></SelectTrigger></FormControl>
                <SelectContent>{available.map((slot) => <SelectItem key={slotKeyFor(slot)} value={slotKeyFor(slot)}>{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
              {resourcesPending ? null : (
                <AvailableTimeNotice
                  reason={timeReason}
                  retryDisabled={busy || selectedAssetId.length === 0 || !date}
                  onRetry={() => {
                    if (!selectedAssetId || !date) return
                    void loadDay(selectedAssetId, date)
                  }}
                />
              )}
              {pastSlotsHidden ? (
                <p id="available-time-state" role="status" className="text-sm text-muted-foreground">
                  {t("rentals.teacherLessons.pastSlotsHidden")}
                </p>
              ) : null}
            </FormItem>
          )} />
          <FormField control={form.control} name="label" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("rentals.teacherLessons.labelOptional")}</FormLabel>
              <FormControl><Input {...field} maxLength={120} disabled={busy} /></FormControl>
            </FormItem>
          )} />
          <FormPrimaryButton type="submit" isValid={isValid} loading={busy} className="sm:col-span-2" data-testid="create-lesson">
            {t("rentals.teacherLessons.create")}
          </FormPrimaryButton>
        </form>
      </Form>
      <section className="space-y-3" aria-labelledby="lessons-heading">
        <h2 id="lessons-heading" className="text-lg font-semibold">{t("rentals.teacherLessons.lessonsForDate")}</h2>
        {resourcesPending ? <p className="text-sm text-muted-foreground" role="status">{t("rentals.teacherLessons.loadingResources")}</p> : lessonsPending ? <p className="text-sm text-muted-foreground" role="status">{t("rentals.teacherLessons.loading")}</p> : lessons.length === 0 ? (
          dayStatus === "error" ? null : <p className="text-sm text-muted-foreground">{t("rentals.teacherLessons.none")}</p>
        ) : lessons.map((lesson) => (
          <article key={`${lesson.id}-${lesson.startTime}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div><p className="font-medium">{lesson.label || lesson.occupancyKindLabel}</p><p className="text-sm text-muted-foreground">{lesson.startTime.slice(0, 5)}–{lesson.endTime.slice(0, 5)}</p></div>
            <Button type="button" onClick={() => setPendingRemoval({ id: lesson.id, startTime: lesson.startTime, endTime: lesson.endTime })} disabled={busy} aria-label={`${t("rentals.teacherLessons.remove")} ${lesson.startTime.slice(0, 5)}`}>{t("rentals.teacherLessons.remove")}</Button>
          </article>
        ))}
      </section>
      <AlertDialog open={pendingRemoval !== null} onOpenChange={(open) => { if (!open && !busy) setPendingRemoval(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rentals.teacherLessons.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("rentals.teacherLessons.confirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} />
            <Button type="button" variant="destructive" disabled={busy || pendingRemoval === null} onClick={() => { void confirmRemoval() }}>
              {t("rentals.teacherLessons.confirmAction")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function slotKeyFor(slot: { startTime: string; endTime: string }) {
  return `${slot.startTime}|${slot.endTime}`
}

function availableTimePlaceholderKey(
  reason: AvailableTimeReason,
  resourcesPending: boolean,
): string {
  if (resourcesPending) {
    return "rentals.teacherLessons.loadingResources"
  }
  if (reason === "loading") {
    return "rentals.teacherLessons.loadingTimes"
  }
  if (reason === "error") {
    return "rentals.teacherLessons.timesError"
  }
  if (reason === "closed") {
    return "rentals.teacherLessons.closedDay"
  }
  if (reason === "noHours") {
    return "rentals.teacherLessons.noHours"
  }
  if (reason === "noneOpen") {
    return "rentals.teacherLessons.noneOpen"
  }
  return "rentals.teacherLessons.chooseTime"
}

function AvailableTimeNotice({
  reason,
  onRetry,
  retryDisabled,
}: {
  reason: AvailableTimeReason
  onRetry: () => void
  retryDisabled: boolean
}) {
  const { t } = useTranslation()
  if (reason === "ready" || reason === "pastOnly") {
    return null
  }
  if (reason === "loading") {
    return (
      <p id="available-time-state" data-testid="available-time-state" role="status" className="text-sm text-muted-foreground">
        {t("rentals.teacherLessons.loadingTimes")}
      </p>
    )
  }
  if (reason === "error") {
    return (
      <div id="available-time-state" data-testid="available-time-state" className="space-y-2">
        <p role="alert" className="text-sm text-destructive">
          {t("rentals.teacherLessons.timesError")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retryDisabled}
        >
          {t("rentals.teacherLessons.retryTimes")}
        </Button>
      </div>
    )
  }
  if (reason === "closed") {
    return (
      <p id="available-time-state" data-testid="available-time-state" role="status" className="text-sm text-muted-foreground">
        {t("rentals.teacherLessons.closedDay")}
      </p>
    )
  }
  if (reason === "noHours") {
    return (
      <p id="available-time-state" data-testid="available-time-state" role="status" className="text-sm text-muted-foreground">
        {t("rentals.teacherLessons.noHours")}{" "}
        {t("rentals.teacherLessons.noHoursHint", {
          screen: t("rentals.schedule.tabs.templates"),
        })}
      </p>
    )
  }
  return (
    <p id="available-time-state" data-testid="available-time-state" role="status" className="text-sm text-muted-foreground">
      {t("rentals.teacherLessons.noneOpen")}
    </p>
  )
}
