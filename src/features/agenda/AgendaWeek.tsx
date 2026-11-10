import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { agendaTypes } from "./urlState"
import type { AgendaBlock, AgendaWeekRow } from "./dayGridModel"

const pipClass: Record<AgendaBlock["kind"], string> = {
  pedido: "border-primary bg-primary/15 text-foreground",
  reserva: "border-foreground/25 bg-accent text-accent-foreground",
  manutencao: "border-dashed border-foreground/40 bg-muted text-foreground",
  bloqueio: "border-border bg-muted text-muted-foreground",
}

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
  error: boolean
  days: string[]
  rows: AgendaWeekRow[]
  today: string
  onOpenDay: (date: string) => void
}

export function AgendaWeek({ loading, error, days, rows, today, onOpenDay }: AgendaWeekProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language

  if (loading) {
    return (
      <div role="status" aria-label={t("staffAgenda.weekLoading")} className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{t("staffAgenda.gridError")}</p>}
      <section aria-label={t("staffAgenda.weekGrid")} className="overflow-hidden rounded-xl border bg-card text-card-foreground">
        <div className="hidden border-b sm:grid sm:grid-cols-[11rem_repeat(7,minmax(0,1fr))]">
          <span className="px-3 py-2 text-xs font-medium text-muted-foreground">{t("staffAgenda.recurso")}</span>
          {days.map((date) => (
            <span key={date} className={`border-l px-2 py-2 text-xs ${date === today ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground"}`}>
              {weekdayLabel(date, locale)}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <section key={row.id} aria-label={row.name} className="border-b last:border-b-0 sm:grid sm:grid-cols-[11rem_repeat(7,minmax(0,1fr))]">
            <h2 className="px-3 py-3 text-sm font-medium">
              {row.name}
              {row.categoryName && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.categoryName}</span>}
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
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 border-l px-1 py-2 text-left first:border-l-0 sm:min-h-14 sm:items-start sm:first:border-l ${cell.date === today ? "bg-primary/10" : ""}`}
                    onClick={() => onOpenDay(cell.date)}
                  >
                    <span className="text-[10px] text-muted-foreground sm:sr-only">{weekdayLabel(cell.date, locale)}</span>
                    {summary.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t("staffAgenda.free")}</span>
                    ) : (
                      <span className="flex flex-wrap justify-center gap-1 sm:justify-start">
                        {agendaTypes.map((kind) => cell.counts[kind] > 0 && (
                          <span key={kind} className={`inline-flex rounded-md border px-1 text-xs font-semibold tabular-nums ${pipClass[kind]}`}>
                            {cell.counts[kind]}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">{t("staffAgenda.weekHint")}</p>
    </div>
  )
}
