import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { agendaKindTone } from "./agendaKindTone"
import { agendaTypes } from "./urlState"
import type { AgendaWeekRow } from "./dayGridModel"
import type { AgendaSourceId } from "./useAgendaDay"

const WEEK_COLUMNS = "sm:grid sm:grid-cols-[13.75rem_repeat(7,minmax(0,1fr))]"

function weekdayLabel(civil: string, locale: string): string {
  const [year, month, day] = civil.split("-").map(Number)
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

type AgendaWeekProps = {
  loading: boolean
  failedSources: AgendaSourceId[]
  days: string[]
  rows: AgendaWeekRow[]
  focusedRows?: AgendaWeekRow[]
  today: string
  onOpenDay: (date: string) => void
}

export function AgendaWeek({ loading, failedSources, days, rows, today, onOpenDay, focusedRows }: AgendaWeekProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language

  if (loading) {
    return (
      <div role="status" aria-label={t("staffAgenda.weekLoading")} className="space-y-3 border-t p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div>
      {failedSources.map((source) => (
        <p key={source} role="status" className="border-t px-5 py-2 text-sm text-muted-foreground">
          {t(`staffAgenda.sourceWarning.${source}`)}
        </p>
      ))}
      <section aria-label={t("staffAgenda.weekGrid")}>
        <div className={cn("hidden border-t", WEEK_COLUMNS)}>
          <span className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("staffAgenda.recurso")}</span>
          {days.map((date) => (
            <span key={date} className={cn("px-3 py-3 text-xs first-letter:uppercase", date === today ? "bg-muted/60 font-medium text-foreground" : "text-muted-foreground")}>
              {weekdayLabel(date, locale)}
            </span>
          ))}
        </div>
        {rows.map((row) => {
          const kind = row.resourceType ? t(`agendas.grid.resourceType.${row.resourceType}`) : null
          const meta = [kind, row.categoryName?.trim()].filter(Boolean).join(" · ")
          return (
            <section key={row.id} aria-label={row.name} className={cn("border-t", WEEK_COLUMNS)}>
              <h2 className="px-5 py-3 text-sm font-medium">
                {row.name}
                {meta && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{meta}</span>}
              </h2>
              <div className="grid grid-cols-7 border-t sm:contents sm:border-t-0">
                {row.cells.map((cell) => {
                  const summary = agendaTypes.flatMap((kind) => (
                    cell.counts[kind] > 0 ? [`${cell.counts[kind]} ${t(`staffAgenda.types.${kind}`)}`] : []
                  ))
                  const label = `${row.name} ${cell.date} ${summary.length > 0 ? summary.join(", ") : t("staffAgenda.free")}`
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      aria-label={label}
                      aria-current={cell.date === today ? "date" : undefined}
                      className={cn(
                        "touch-target flex min-h-[4.25rem] flex-col items-center justify-center gap-1 border-l px-1 py-2 text-left outline-none first:border-l-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:items-start sm:px-3 sm:first:border-l",
                        cell.date === today && "bg-muted/60",
                      )}
                      onClick={() => onOpenDay(cell.date)}
                    >
                      <span className="text-xs text-muted-foreground sm:sr-only">{weekdayLabel(cell.date, locale)}</span>
                      {summary.length === 0 ? (
                        <span className="text-xs text-muted-foreground">{t("staffAgenda.free")}</span>
                      ) : (
                        <span className="flex flex-wrap justify-center gap-1 sm:justify-start">
                          {agendaTypes.flatMap((kind) => {
                            const total = cell.counts[kind]
                            const selected = focusedRows
                              ? kind === "pedido" ? Math.min(total, focusedRows.find((focused) => focused.id === row.id)?.cells.find((focused) => focused.date === cell.date)?.counts.pedido ?? 0) : 0
                              : total
                            return [{ count: selected, dim: false }, { count: total - selected, dim: true }]
                              .filter(({ count }) => count > 0)
                              .map(({ count, dim }) => <span key={`${kind}:${dim}`}
                                aria-label={focusedRows ? t(dim ? "agendas.otherUses" : "agendas.selectedProductOrders", { count, kind: t(`staffAgenda.types.${kind}`) }) : undefined}
                                className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums", agendaKindTone[kind].pill, dim && "opacity-40")}>
                                {count}
                              </span>)
                          })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </section>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">{t("staffAgenda.weekHint")}</p>
    </div>
  )
}
