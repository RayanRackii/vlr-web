import { useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

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
import { useTeacherLessons } from "@/features/rentals/hooks/useTeacherLessons"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"

export function TeacherLessonsPage() {
  const { t } = useTranslation()
  const { assets, day, loading, busy, loadDay, create, remove } = useTeacherLessons(t)
  const available = day?.slots.filter((slot) => slot.occupancyKindKey === "open" && slot.status === "Available") ?? []
  const lessons = day?.slots.filter((slot) => slot.occupancyKindKey === "lesson" && slot.status === "Available") ?? []
  const schema = useMemo(() => z.object({
    assetId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slotKey: z.string()
      .min(1, { message: t("rentals.teacherLessons.slotRequired") })
      .refine((value) => !value || available.some((slot) => slotKeyFor(slot) === value), {
        message: t("rentals.teacherLessons.slotUnavailable"),
      }),
    label: z.string().max(120),
  }), [available, t])
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { assetId: "", date: todayIsoDate(), slotKey: "", label: "" },
  })
  const { getValues, setError, setValue } = form
  const assetId = useWatch({ control: form.control, name: "assetId" })
  const date = useWatch({ control: form.control, name: "date" })
  const slotKey = useWatch({ control: form.control, name: "slotKey" })
  const label = useWatch({ control: form.control, name: "label" })
  const values = { assetId, date, slotKey, label }
  const isValid = schema.safeParse(values).success

  useEffect(() => {
    if (!assets.length || assetId) return
    setValue("assetId", assets[0].id, { shouldValidate: true })
  }, [assetId, assets, setValue])

  useEffect(() => {
    if (!assetId || !date) return
    const selectedBeforeRefresh = getValues("slotKey")
    void loadDay(assetId, date).then((result) => {
      if (!result) return
      const selected = getValues("slotKey") || selectedBeforeRefresh
      if (!selected || result.slots.some((slot) => slotKeyFor(slot) === selected && slot.occupancyKindKey === "open")) return
      const message = t("rentals.teacherLessons.slotUnavailable")
      setValue("slotKey", "", { shouldValidate: false })
      setError("slotKey", { type: "validate", message })
      toast.error(message)
    })
  }, [assetId, date, getValues, loadDay, setError, setValue, t])

  async function onSubmit(valuesToSubmit: FormValues) {
    const slot = available.find((item) => slotKeyFor(item) === valuesToSubmit.slotKey)
    if (!slot) {
      const message = t("rentals.teacherLessons.slotUnavailable")
      setError("slotKey", { type: "validate", message })
      toast.error(message)
      return
    }
    try {
      await create({ assetId: valuesToSubmit.assetId, date: valuesToSubmit.date, slot, label: valuesToSubmit.label })
      form.setValue("label", "")
      form.setValue("slotKey", "", { shouldValidate: true })
      await loadDay(valuesToSubmit.assetId, valuesToSubmit.date)
    } catch {
      // The hook reports API errors and keeps the form values for correction.
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6" data-testid="teacher-lessons-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("rentals.teacherLessons.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rentals.teacherLessons.description")}</p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <FormField control={form.control} name="assetId" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("rentals.teacherLessons.court")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} items={assets.map((asset) => ({ value: asset.id, label: asset.name }))} disabled={loading || busy || assets.length === 0}>
                <FormControl><SelectTrigger aria-label={t("rentals.teacherLessons.court")}><SelectValue placeholder={t("rentals.teacherLessons.court")} /></SelectTrigger></FormControl>
                <SelectContent>{assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("rentals.teacherLessons.date")}</FormLabel>
              <FormControl><Input {...field} aria-label={t("rentals.teacherLessons.date")} type="date" min={todayIsoDate()} disabled={busy} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="slotKey" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("rentals.teacherLessons.availableTime")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} items={available.map((slot) => ({ value: slotKeyFor(slot), label: `${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}` }))} disabled={busy || available.length === 0}>
                <FormControl><SelectTrigger aria-label={t("rentals.teacherLessons.availableTime")}><SelectValue placeholder={t("rentals.teacherLessons.chooseTime")} /></SelectTrigger></FormControl>
                <SelectContent>{available.map((slot) => <SelectItem key={slotKeyFor(slot)} value={slotKeyFor(slot)}>{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
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
        {lessons.length === 0 ? <p className="text-sm text-muted-foreground">{t("rentals.teacherLessons.none")}</p> : lessons.map((lesson) => (
          <article key={`${lesson.id}-${lesson.startTime}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div><p className="font-medium">{lesson.label || lesson.occupancyKindLabel}</p><p className="text-sm text-muted-foreground">{lesson.startTime.slice(0, 5)}–{lesson.endTime.slice(0, 5)}</p></div>
            <Button type="button" onClick={() => void remove(assetId, date, lesson.startTime, lesson.endTime).then(() => loadDay(assetId, date)).catch(() => undefined)} disabled={busy} aria-label={`${t("rentals.teacherLessons.remove")} ${lesson.startTime.slice(0, 5)}`}>{t("rentals.teacherLessons.remove")}</Button>
          </article>
        ))}
      </section>
    </main>
  )
}

function slotKeyFor(slot: { startTime: string; endTime: string }) {
  return `${slot.startTime}|${slot.endTime}`
}
