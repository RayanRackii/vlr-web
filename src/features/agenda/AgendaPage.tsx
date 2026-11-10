import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { addCivilDays, civilToday, formatDayLabel, startOfCivilWeek } from "@/features/catalog/components/agenda/agendaLayout"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { AgendaDayGrid } from "./AgendaDayGrid"
import { AgendaWeek } from "./AgendaWeek"
import { useAgendaDay } from "./useAgendaDay"
import { agendaFilterKeys, agendaTypes, parseAgendaState, serializeAgendaState, type AgendaState } from "./urlState"
import { agendaOptionLoaders, useAgendaOptions, type AgendaOption } from "./useAgendaOptions"

type ChipRowProps = {
  label: string
  value: string | null
  options: AgendaOption[]
  onSelect: (value: string | null) => void
}

function ChipRow({ label, value, options, onSelect }: ChipRowProps) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-center">
      <span className="text-sm font-medium text-muted-foreground sm:w-24">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-2">
      {[{ id: null, label: t("staffAgenda.all") }, ...options].map((option) => (
        <Button key={option.id ?? "all"} type="button" className="min-h-11 rounded-full" variant={value === option.id ? "default" : "outline"} aria-pressed={value === option.id} onClick={() => onSelect(option.id)}>
          {option.label}
        </Button>
      ))}
      </div>
    </div>
  )
}

function LoadedChipRow({ load, ...props }: Omit<ChipRowProps, "options"> & { load: () => Promise<AgendaOption[]> }) {
  const { t } = useTranslation()
  const { options, loading, error } = useAgendaOptions(load)
  return (
    <div>
      <ChipRow {...props} options={options} />
      {loading && <div role="status" aria-label={t("staffAgenda.loading", { label: props.label })} className="flex gap-2 pb-3"><Skeleton variant="shimmer" className="h-11 w-24 rounded-full" /><Skeleton variant="shimmer" className="h-11 w-32 rounded-full" /></div>}
      {error && <p role="alert" className="text-sm text-destructive">{t("staffAgenda.loadError", { label: props.label })}</p>}
    </div>
  )
}

export function AgendaPage() {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const { can, activeModules, isLoading, currentUser } = usePermissions()
  const [params, setParams] = useSearchParams()
  const today = civilToday(timeZone)
  const state = parseAgendaState(params, today)
  const update = (patch: Partial<AgendaState>) => setParams(serializeAgendaState({ ...state, ...patch }, params))
  const count = agendaFilterKeys.filter((key) => state[key] !== null).length
  const locale = i18n.resolvedLanguage ?? i18n.language
  const weekStart = startOfCivilWeek(state.date)
  const dateLabel = state.visao === "dia" ? formatDayLabel(state.date, locale)
    : `${formatDayLabel(weekStart, locale)} – ${formatDayLabel(addCivilDays(weekStart, 6), locale)}`
  const rentals = !isLoading && activeModules.includes("rentals")
  const catalog = !isLoading && activeModules.includes("catalog")
  const rentalFilters = rentals && (can("rentals.assets.read") || can("rentals.schedule.read"))
  const productFilters = catalog && can("catalog.products.read")
  const orderFilters = catalog && can("catalog.orders.read")
  const tenantKey = currentUser?.tenantId ?? "current"
  const day = useAgendaDay(
    state,
    timeZone,
    {
      assets: rentals && can("rentals.assets.read"),
      schedule: rentals && can("rentals.schedule.read"),
      reservations: rentals && can("rentals.reservations.read"),
      orders: orderFilters,
    },
    currentUser?.tenantId ?? null,
    !isLoading,
  )

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.agenda")}</h1>
        <div role="group" aria-label={t("staffAgenda.view")} className="flex w-full flex-wrap gap-2 sm:w-auto">
          {(["dia", "semana"] as const).map((visao) => <Button key={visao} type="button" className="min-h-11 flex-1 sm:flex-none" variant={state.visao === visao ? "default" : "outline"} aria-pressed={state.visao === visao} onClick={() => update({ visao })}>{t(`staffAgenda.${visao}`)}</Button>)}
        </div>
        <div role="group" aria-label={t("staffAgenda.dateNavigation")} className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => update({ date: addCivilDays(state.date, state.visao === "dia" ? -1 : -7) })}>{t("staffAgenda.previous")}</Button>
          <Button type="button" variant="outline" onClick={() => update({ date: today })}>{t("staffAgenda.today")}</Button>
          <Button type="button" variant="outline" onClick={() => update({ date: addCivilDays(state.date, state.visao === "dia" ? 1 : 7) })}>{t("staffAgenda.next")}</Button>
          <span aria-live="polite" className="text-sm font-medium">{dateLabel}</span>
        </div>
      </header>
      <section aria-label={t("staffAgenda.filters")} className="rounded-xl border bg-card px-4 text-card-foreground">
        {rentalFilters && <LoadedChipRow key={`${tenantKey}:recurso`} label={t("staffAgenda.recurso")} value={state.recurso} load={agendaOptionLoaders.recurso} onSelect={(recurso) => update({ recurso })} />}
        {productFilters && <LoadedChipRow key={`${tenantKey}:produto`} label={t("staffAgenda.produto")} value={state.produto} load={agendaOptionLoaders.produto} onSelect={(produto) => update({ produto })} />}
        {orderFilters && <LoadedChipRow key={`${tenantKey}:pedido`} label={t("staffAgenda.pedido")} value={state.pedido} load={agendaOptionLoaders.pedido} onSelect={(pedido) => update({ pedido })} />}
        <ChipRow label={t("staffAgenda.tipo")} value={state.tipo} options={agendaTypes.map((id) => ({ id, label: t(`staffAgenda.types.${id}`) }))} onSelect={(value) => update({ tipo: agendaTypes.find((tipo) => tipo === value) ?? null })} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t py-3">
          <p role="status" className="text-sm text-muted-foreground">{t("staffAgenda.applied", { count })}</p>
          <Button type="button" variant="ghost" onClick={() => update({ recurso: null, produto: null, pedido: null, tipo: null })}>{t("staffAgenda.clear")}</Button>
        </div>
      </section>
      {state.visao === "dia" ? (
        <AgendaDayGrid
          loading={isLoading || day.loading}
          failedSources={day.failedSources}
          rows={day.day.rows}
          start={day.day.start}
          end={day.day.end}
          canReserve={rentals && can("rentals.reservations.read")}
          canBlock={rentals && can("rentals.schedule.read") && can("rentals.assets.read")}
        />
      ) : (
        <AgendaWeek
          loading={isLoading || day.loading}
          failedSources={day.failedSources}
          days={day.week.days}
          rows={day.week.rows}
          today={today}
          onOpenDay={(date) => update({ visao: "dia", date })}
        />
      )}
    </div>
  )
}
