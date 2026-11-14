import { Ban, Plus } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { FilterTabs } from "@/components/data-table/FilterTabs"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { DateNavigator } from "@/components/ui/date-navigator"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { addCivilDays, civilToday, formatDayLabel, startOfCivilWeek, zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { AgendaFooter, BusinessHoursLabel } from "./AgendaCardParts"
import { AgendaDayGrid } from "./AgendaDayGrid"
import { AgendaFilterMenu, type AgendaFilterFieldsProps } from "./AgendaFilterPanel"
import { AgendaFilters } from "./AgendaFilters"
import { AgendaWeek } from "./AgendaWeek"
import { formatClock } from "./dayGridModel"
import { useAgendaDay } from "./useAgendaDay"
import { useNow } from "./useNow"
import { useAgendaProductOptions } from "./useAgendaOptions"
import { agendaTypes, parseAgendaState, serializeAgendaState, type AgendaState } from "./urlState"
import "./agendas.css"

export type AgendasView = "overview" | "resources" | "product"

const dayViews = ["dia", "semana"] as const
// Tab order after "Todos" (also the legend order).
const chipKinds = ["pedido", "reserva", "manutencao", "bloqueio"] as const

/** "14 de novembro, 2026" and the weekday ("sábado") of a civil date. */
function longDate(civil: string, locale: string, format: (key: string, options: Record<string, string | number>) => string) {
  const [year, month, day] = civil.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date)
  return { label: format("agendas.dateLong", { day, month: part({ month: "long" }), year }), weekday: part({ weekday: "long" }) }
}

export function AgendasPage({ view }: { view: AgendasView }) {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const { can, activeModules, isLoading, currentUser } = usePermissions()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const today = civilToday(timeZone)
  const state = parseAgendaState(params, today)
  const tenantId = currentUser?.tenantId ?? null
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
  }, tenantId, !isLoading, productView ? state.produto : null)
  const canReserve = rentals && can("rentals.reservations.read")
  const canBlock = rentals && can("rentals.schedule.read") && can("rentals.assets.read")
  const canReadProducts = catalog && can("catalog.products.read")
  const products = useAgendaProductOptions(tenantId, canReadProducts)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const weekStart = startOfCivilWeek(state.date)
  const week = state.visao === "semana"
  const long = longDate(state.date, locale, t)
  const dateLabel = week ? `${formatDayLabel(weekStart, locale)} – ${formatDayLabel(addCivilDays(weekStart, 6), locale)}` : long.label
  const loading = isLoading || day.loading
  const now = useNow()
  const updatedAt = day.updatedAt
  const nowMinutes = now !== null && state.date === today ? zonedDayAndMinutes(new Date(now).toISOString(), timeZone)?.minutes ?? null : null
  const resourceCount = week ? day.week.rows.length : day.day.rows.length
  const activities = week
    ? day.week.rows.reduce((sum, row) => sum + row.cells.reduce((cellSum, cell) => cellSum + agendaTypes.reduce((kindSum, kind) => kindSum + cell.counts[kind], 0), 0), 0)
    : day.day.rows.reduce((sum, row) => sum + row.blocks.length, 0)
  // The reservations screen opens as before; the resource and slot travel as query params for it to pick up.
  const createReservation = (rentalAssetId: string, minutes: number) =>
    navigate(`/configuracoes/reservas?${new URLSearchParams({ rentalAssetId, date: state.date, startTime: formatClock(minutes) })}`)

  const filterProps: AgendaFilterFieldsProps = {
    state,
    resources: day.resources,
    showResources: rentals && (can("rentals.assets.read") || can("rentals.schedule.read")),
    showProducts: canReadProducts || day.availableProducts.length > 0,
    products: canReadProducts ? products.options : day.availableProducts,
    productsLoading: canReadProducts && products.loading,
    productsError: canReadProducts && products.error,
    requiredProduct: productView,
    onChange: update,
  }
  const total = agendaTypes.reduce((sum, kind) => sum + day.typeCounts[kind], 0)
  const typeOptions = chipKinds.map((value) => ({ value, label: t(`agendas.chips.${value}`), count: day.typeCounts[value] }))

  return (
    <Page
      width="full"
      className={`agendas-page agendas-${view}`}
      header={{
        eyebrow: t("agendas.eyebrow"),
        title: t(`agendas.${view}.title`),
        description: t(view === "overview" && week ? "agendas.overview.subtitleWeek" : `agendas.${view}.subtitle`),
        actions: canReserve || canBlock ? (
          <>
            {canBlock && (
              <Button variant="outline" className="touch-target min-h-11" render={<Link to="/configuracoes/agenda" />}>
                <Ban className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                {t("staffAgenda.blockPeriod")}
              </Button>
            )}
            {canReserve && (
              <Button className="touch-target min-h-11" render={<Link to="/configuracoes/reservas" />}>
                <Plus className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                {t("agendas.newReservation")}
              </Button>
            )}
          </>
        ) : undefined,
      }}
    >
      <div role="group" aria-label={t("staffAgenda.dateNavigation")}>
        <DateNavigator
          layout="toolbar"
          date={state.date}
          onDateChange={(date) => update({ date })}
          view={state.visao}
          views={dayViews.map((value) => ({ value, label: t(`staffAgenda.${value}`) }))}
          onViewChange={(visao) => update({ visao })}
          step={(date, visao, direction) => addCivilDays(date, visao === "dia" ? direction : direction * 7)}
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
        <div className="flex min-w-0 items-center justify-between gap-3 px-5">
          <FilterTabs
            className="flex-1"
            label={t("staffAgenda.tipo")}
            allLabel={t("staffAgenda.all")}
            value={state.tipo}
            onChange={(tipo) => update({ tipo })}
            allCount={total}
            options={typeOptions}
          />
          <AgendaFilters key={currentUser?.tenantId ?? "current"} order={catalog && can("catalog.orders.read")} tenantId={tenantId} value={state.pedido} onChange={(pedido) => update({ pedido })} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5">
          <AgendaFilterMenu {...filterProps} />
          <BusinessHoursLabel hours={day.day.businessHours} />
        </div>
        {productView && !state.produto ? <p className="border-t py-8 text-center text-sm text-muted-foreground">{t("agendas.chooseProduct")}</p>
          : week ? <AgendaWeek loading={loading} failedSources={day.failedSources} days={day.week.days} rows={day.week.rows} focusedRows={day.focusedWeek} today={today} onOpenDay={(date) => update({ visao: "dia", date })} />
          : <AgendaDayGrid loading={loading} failedSources={day.failedSources} rows={day.day.rows} start={day.day.start} end={day.day.end}
              canReserve={canReserve} canBlock={canBlock} nowMinutes={nowMinutes} onCreateReservation={createReservation}
              focusedProductId={productView ? state.produto : null} focusDate={state.date} />}
        <AgendaFooter
          resources={resourceCount}
          activities={activities}
          week={week}
          kinds={chipKinds.filter((kind) => day.typeCounts[kind] > 0)}
          updatedMinutes={updatedAt !== null && now !== null ? Math.max(0, Math.floor((now - updatedAt) / 60_000)) : null}
        />
      </section>
    </Page>
  )
}
