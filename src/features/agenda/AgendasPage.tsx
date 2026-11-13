import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { addCivilDays, civilToday, formatDayLabel, startOfCivilWeek } from "@/features/catalog/components/agenda/agendaLayout"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { AgendaDayGrid } from "./AgendaDayGrid"
import { AgendaFilters } from "./AgendaFilters"
import { AgendaWeek } from "./AgendaWeek"
import { useAgendaDay } from "./useAgendaDay"
import { parseAgendaState, serializeAgendaState, type AgendaState } from "./urlState"
import "./agendas.css"

export type AgendasView = "overview" | "resources" | "product"

export function AgendasPage({ view }: { view: AgendasView }) {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const { can, activeModules, isLoading, currentUser } = usePermissions()
  const [params, setParams] = useSearchParams()
  const today = civilToday(timeZone)
  const state = parseAgendaState(params, today)
  const update = (patch: Partial<AgendaState>) => setParams(serializeAgendaState({ ...state, ...patch }, params))
  const rentals = !isLoading && activeModules.includes("rentals")
  const catalog = !isLoading && activeModules.includes("catalog")
  const productView = view === "product"
  // Keep other uses visible in the product view; emphasize its orders on the existing grid.
  const day = useAgendaDay(productView ? { ...state, produto: null } : state, timeZone, {
    assets: rentals && can("rentals.assets.read"),
    schedule: rentals && can("rentals.schedule.read"),
    reservations: rentals && can("rentals.reservations.read"),
    orders: catalog && can("catalog.orders.read"),
  }, currentUser?.tenantId ?? null, !isLoading, productView ? state.produto : null)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const weekStart = startOfCivilWeek(state.date)
  const dateLabel = state.visao === "dia" ? formatDayLabel(state.date, locale)
    : `${formatDayLabel(weekStart, locale)} – ${formatDayLabel(addCivilDays(weekStart, 6), locale)}`


  return (
    <Page
      className={`agendas-page agendas-${view}`}
      header={{ eyebrow: t("agendas.eyebrow"), title: t(`agendas.${view}.title`), description: t(`agendas.${view}.subtitle`) }}
    >
      <div role="group" aria-label={t("staffAgenda.dateNavigation")} className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => update({ date: addCivilDays(state.date, state.visao === "dia" ? -1 : -7) })}>{t("staffAgenda.previous")}</Button>
        <Button variant="outline" onClick={() => update({ date: today })}>{t("staffAgenda.today")}</Button>
        <Button variant="outline" onClick={() => update({ date: addCivilDays(state.date, state.visao === "dia" ? 1 : 7) })}>{t("staffAgenda.next")}</Button>
        <span aria-live="polite" className="text-sm font-medium">{dateLabel}</span>
        <div role="group" aria-label={t("staffAgenda.view")} className="flex gap-1 sm:ml-auto">
          {(["dia", "semana"] as const).map((visao) => <Button key={visao} variant={state.visao === visao ? "default" : "outline"} aria-pressed={state.visao === visao} onClick={() => update({ visao })}>{t(`staffAgenda.${visao}`)}</Button>)}
        </div>
      </div>
      <section className="overflow-visible rounded-xl border border-border bg-card text-card-foreground">
        <AgendaFilters key={currentUser?.tenantId ?? "current"} state={state}
          rental={rentals && (can("rentals.assets.read") || can("rentals.schedule.read"))}
          product={catalog && can("catalog.products.read")} order={catalog && can("catalog.orders.read")}
          onChange={update} modern requiredProduct={productView} availableProducts={productView ? day.availableProducts : []} />
        <div className="min-w-0 p-3">
          {productView && !state.produto ? <p className="py-8 text-center text-sm text-muted-foreground">{t("agendas.chooseProduct")}</p>
            : state.visao === "dia" ? <AgendaDayGrid loading={isLoading || day.loading} failedSources={day.failedSources} rows={day.day.rows} start={day.day.start} end={day.day.end}
              canReserve={rentals && can("rentals.reservations.read")} canBlock={rentals && can("rentals.schedule.read") && can("rentals.assets.read")}
              focusedProductId={productView ? state.produto : null} focusDate={state.date} />
            : <AgendaWeek loading={isLoading || day.loading} failedSources={day.failedSources} days={day.week.days} rows={day.week.rows} focusedRows={day.focusedWeek} today={today} onOpenDay={(date) => update({ visao: "dia", date })} />}
        </div>
      </section>
    </Page>
  )
}
