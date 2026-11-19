import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { DateNavigator } from "@/components/ui/date-navigator"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ErrorState"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { addCivilDays, civilDateParam, civilToday, formatDayLabel, startOfCivilWeek, zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import { useNow } from "@/features/agenda/useNow"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { tenantKey } from "@/lib/queryKeys"
import { canCreateAllocation } from "../model/allocationActions"
import { formatMinutes, agendaRange, buildDayModel, buildWeekModel, summarize } from "../model/gridModel"
import { describePlanningError } from "../model/planningErrors"
import type { PlanningAgenda, PlanningAllocation } from "../schemas/planningSchemas"
import { getPlanningAgenda } from "../services/planningService"
import { AllocationDialog, type AllocationDialogTarget } from "./AllocationDialog"
import { AllocationSheet } from "./AllocationSheet"
import { PlanningDayGrid, PlanningWeekGrid } from "./PlanningTimeline"
import { planningTone } from "./planningTone"
import "@/features/agenda/agendas.css"

const views = ["dia", "semana"] as const
type View = (typeof views)[number]
const legend = ["scheduled", "running", "cleaning", "released", "unavailable"] as const

/** "14 de novembro, 2026" and the weekday of a civil date. */
function longDate(civil: string, locale: string) {
  const [year, month, day] = civil.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date)
  return { label: part({ day: "numeric", month: "long", year: "numeric" }), weekday: part({ weekday: "long" }) }
}

export function PlanningAgendaPage() {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const queryClient = useQueryClient()
  const { can, isLoading: permissionsLoading, currentUser } = usePermissions()
  const tenantId = currentUser?.tenantId ?? null
  const [params, setParams] = useSearchParams()
  const today = civilToday(timeZone)
  const date = civilDateParam(params.get("date")) ?? today
  const view: View = params.get("visao") === "semana" ? "semana" : "dia"
  const week = view === "semana"
  const locale = i18n.resolvedLanguage ?? i18n.language
  const canCreate = canCreateAllocation(can)
  const update = (patch: { date?: string; visao?: View }) => {
    const next = new URLSearchParams(params)
    next.set("date", patch.date ?? date)
    next.set("visao", patch.visao ?? view)
    setParams(next)
  }

  const weekStart = startOfCivilWeek(date)
  const range = useMemo(() => (week ? agendaRange(weekStart, addCivilDays(weekStart, 6), timeZone) : agendaRange(date, date, timeZone)), [week, weekStart, date, timeZone])
  const agendaKey = tenantKey("staff", tenantId, "planning-agenda", range.from, range.to)
  const agenda = useQuery({ queryKey: agendaKey, queryFn: () => getPlanningAgenda(range), enabled: !permissionsLoading, refetchInterval: 60_000 })
  const now = useNow()
  const nowMs = now ?? 0

  const [dialog, setDialog] = useState<AllocationDialogTarget | null>(null)
  const [selected, setSelected] = useState<PlanningAllocation | null>(null)
  // Prefer the freshest copy from the agenda; fall back to the one that was clicked.
  const shown = selected ? agenda.data?.items.find((item) => item.id === selected.id) ?? selected : null

  const data: PlanningAgenda | undefined = agenda.data
  const dayRows = useMemo(() => (data && !week ? buildDayModel(data, date, timeZone, nowMs) : []), [data, week, date, timeZone, nowMs])
  const weekModel = useMemo(() => (data && week ? buildWeekModel(data, weekStart, timeZone, nowMs) : { days: [], rows: [] }), [data, week, weekStart, timeZone, nowMs])
  const summary = data ? summarize(data) : null
  const nowMinutes = now !== null && !week && date === today ? zonedDayAndMinutes(new Date(now).toISOString(), timeZone)?.minutes ?? null : null
  const long = longDate(date, locale)
  const dateLabel = week ? `${formatDayLabel(weekStart, locale)} – ${formatDayLabel(addCivilDays(weekStart, 6), locale)}` : long.label
  const error = agenda.error ? describePlanningError(agenda.error) : null

  const patchCache = (updated: PlanningAllocation) => {
    queryClient.setQueriesData<PlanningAgenda>({ queryKey: tenantKey("staff", tenantId, "planning-agenda") }, (current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current)
    setSelected(updated)
  }

  return (
    <Page
      width="full"
      className="agendas-page agendas-planning"
      header={{
        eyebrow: t("agendas.eyebrow"),
        title: t("planning.title"),
        description: t("planning.subtitle"),
        actions: canCreate ? (
          <Button className="touch-target min-h-11" onClick={() => setDialog({ mode: "create", prefill: { date } })}>
            <Plus className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            {t("planning.newAllocation")}
          </Button>
        ) : undefined,
      }}
    >
      <div role="group" aria-label={t("staffAgenda.dateNavigation")}>
        <DateNavigator
          layout="toolbar"
          date={date}
          onDateChange={(next) => update({ date: next })}
          view={view}
          views={views.map((value) => ({ value, label: t(`staffAgenda.${value}`) }))}
          onViewChange={(visao) => update({ visao })}
          step={(current, visao, direction) => addCivilDays(current, visao === "dia" ? direction : direction * 7)}
          today={today}
          label={dateLabel}
          secondaryLabel={week ? undefined : long.weekday}
          labels={{
            previous: { dia: t("agendas.nav.previousDay"), semana: t("agendas.nav.previousWeek") },
            next: { dia: t("agendas.nav.nextDay"), semana: t("agendas.nav.nextWeek") },
            today: t("staffAgenda.today"),
            view: t("staffAgenda.view"),
            pickDate: t("agendas.nav.pickDate"),
          }}
        />
      </div>
      <section className="min-w-0 rounded-xl border border-border bg-card text-card-foreground">
        {agenda.isPending ? (
          <div role="status" aria-label={t("planning.grid.loading")} className="space-y-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <ErrorState className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4" message={error.message} onRetry={() => void agenda.refetch()} />
        ) : data && data.resources.length === 0 ? (
          <div className="px-6 py-14 text-center" data-testid="planning-empty">
            <p className="text-sm font-medium">{t("planning.empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("planning.empty.description")}</p>
          </div>
        ) : week ? (
          <PlanningWeekGrid
            days={weekModel.days}
            rows={weekModel.rows}
            today={today}
            timeZone={timeZone}
            canCreate={canCreate}
            onSelect={setSelected}
            onOpenDay={(next) => update({ visao: "dia", date: next })}
            onCreate={(assetId, day) => setDialog({ mode: "create", prefill: { assetId, date: day } })}
          />
        ) : (
          <PlanningDayGrid
            rows={dayRows}
            timeZone={timeZone}
            nowMinutes={nowMinutes}
            canCreate={canCreate}
            onSelect={setSelected}
            onCreate={(assetId, minutes) => setDialog({ mode: "create", prefill: { assetId, date, startTime: formatMinutes(minutes) } })}
          />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-2">
            <span>{t("planning.footer.resources", { count: summary?.resources ?? 0 })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("planning.footer.allocations", { count: summary?.allocations ?? 0 })}</span>
            {summary && summary.overdue > 0 && <><span aria-hidden="true">·</span><span className="font-medium text-destructive">{t("planning.footer.overdue", { count: summary.overdue })}</span></>}
            {summary && summary.expired > 0 && <><span aria-hidden="true">·</span><span>{t("planning.footer.expired", { count: summary.expired })}</span></>}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {legend.map((tone) => (
              <span key={tone} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={`size-1.5 rounded-full ${planningTone[tone].dot}`} />
                {t(planningTone[tone].label)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-muted ring-1 ring-border" />{t("planning.grid.closed")}</span>
          </div>
        </footer>
      </section>
      <AllocationDialog target={dialog} onOpenChange={(open) => { if (!open) setDialog(null) }} />
      <AllocationSheet
        allocation={shown}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
        onEdit={(allocation) => { setSelected(null); setDialog({ mode: "edit", allocation }) }}
        onChanged={patchCache}
      />
    </Page>
  )
}
