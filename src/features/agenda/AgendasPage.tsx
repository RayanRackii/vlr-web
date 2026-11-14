import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { StatusChips } from "@/components/data-table/StatusChips"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { DateNavigator } from "@/components/ui/date-navigator"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { addCivilDays, civilToday, formatDayLabel, startOfCivilWeek } from "@/features/catalog/components/agenda/agendaLayout"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { AgendaDayGrid } from "./AgendaDayGrid"
import { AgendaFilterPanel, AgendaFilterSheet, type AgendaFilterFieldsProps } from "./AgendaFilterPanel"
import { useIsDesktop } from "./agendaFilterModel"
import { AgendaFilters } from "./AgendaFilters"
import { AgendaWeek } from "./AgendaWeek"
import { useAgendaDay } from "./useAgendaDay"
import { agendaOptionLoaders, useAgendaOptions, type AgendaOption } from "./useAgendaOptions"
import { agendaTypes, parseAgendaState, serializeAgendaState, type AgendaState } from "./urlState"
import "./agendas.css"

export type AgendasView = "overview" | "resources" | "product"

const emptyOptions = async (): Promise<AgendaOption[]> => []
const dayViews = ["dia", "semana"] as const
// Chip order after "Todos".
const chipKinds = ["pedido", "reserva", "manutencao", "bloqueio"] as const

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
  const desktop = useIsDesktop()
  const canReserve = rentals && can("rentals.reservations.read")
  const canBlock = rentals && can("rentals.schedule.read") && can("rentals.assets.read")
  const canReadProducts = catalog && can("catalog.products.read")
  const products = useAgendaOptions(canReadProducts ? agendaOptionLoaders.produto : emptyOptions)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const weekStart = startOfCivilWeek(state.date)
  const dateLabel = state.visao === "dia" ? formatDayLabel(state.date, locale)
    : `${formatDayLabel(weekStart, locale)} – ${formatDayLabel(addCivilDays(weekStart, 6), locale)}`

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
        description: t(`agendas.${view}.subtitle`),
        actions: canReserve || canBlock ? (
          <>
            {canBlock && <Button variant="outline" className="touch-target min-h-11" render={<Link to="/configuracoes/agenda" />}>{t("staffAgenda.blockPeriod")}</Button>}
            {canReserve && <Button className="touch-target min-h-11" render={<Link to="/configuracoes/reservas" />}>{t("agendas.newReservation")}</Button>}
          </>
        ) : undefined,
      }}
    >
      <div role="group" aria-label={t("staffAgenda.dateNavigation")}>
        <DateNavigator
          date={state.date}
          onDateChange={(date) => update({ date })}
          view={state.visao}
          views={dayViews.map((value) => ({ value, label: t(`staffAgenda.${value}`) }))}
          onViewChange={(visao) => update({ visao })}
          step={(date, visao, direction) => addCivilDays(date, visao === "dia" ? direction : direction * 7)}
          today={today}
          label={dateLabel}
          labels={{
            previous: { dia: t("agendas.nav.previousDay"), semana: t("agendas.nav.previousWeek") },
            next: { dia: t("agendas.nav.nextDay"), semana: t("agendas.nav.nextWeek") },
            today: t("staffAgenda.today"),
            view: t("staffAgenda.view"),
            pickDate: t("agendas.nav.pickDate"),
          }}
        />
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <StatusChips
            label={t("staffAgenda.tipo")}
            allLabel={t("staffAgenda.all")}
            value={state.tipo}
            onChange={(tipo) => update({ tipo })}
            allCount={total}
            options={typeOptions}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <AgendaFilters key={currentUser?.tenantId ?? "current"} order={catalog && can("catalog.orders.read")} value={state.pedido} onChange={(pedido) => update({ pedido })} />
          {!desktop && <AgendaFilterSheet {...filterProps} />}
        </div>
      </div>
      <div className="flex min-w-0 items-start gap-4">
        {desktop && <AgendaFilterPanel {...filterProps} />}
        <section className="min-w-0 flex-1 overflow-visible rounded-xl border border-border bg-card p-3 text-card-foreground">
          {productView && !state.produto ? <p className="py-8 text-center text-sm text-muted-foreground">{t("agendas.chooseProduct")}</p>
            : state.visao === "dia" ? <AgendaDayGrid loading={isLoading || day.loading} failedSources={day.failedSources} rows={day.day.rows} start={day.day.start} end={day.day.end}
              canReserve={canReserve} canBlock={canBlock}
              focusedProductId={productView ? state.produto : null} focusDate={state.date} />
            : <AgendaWeek loading={isLoading || day.loading} failedSources={day.failedSources} days={day.week.days} rows={day.week.rows} focusedRows={day.focusedWeek} today={today} onOpenDay={(date) => update({ visao: "dia", date })} />}
        </section>
      </div>
    </Page>
  )
}
