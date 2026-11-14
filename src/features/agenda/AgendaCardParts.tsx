import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { agendaKindTone, type AgendaKind } from "./agendaKindTone"
import { formatClock } from "./dayGridModel"

/** Right side of the info row: "Horário comercial · 08:00 – 20:00" or "Horário variável". */
export function BusinessHoursLabel({ hours }: { hours: { open: number; close: number } | null }) {
  const { t } = useTranslation()
  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {hours ? t("agendas.grid.businessHours", { start: formatClock(hours.open), end: formatClock(hours.close) }) : t("agendas.grid.variableHours")}
    </span>
  )
}

type FooterProps = {
  resources: number
  activities: number
  week: boolean
  /** Kinds that exist in the period, in legend order. */
  kinds: AgendaKind[]
  /** Minutes since the last successful load; null while nothing has loaded. */
  updatedMinutes: number | null
}

/** Footer of the agenda card: counts on the left, legend and freshness on the right. */
export function AgendaFooter({ resources, activities, week, kinds, updatedMinutes }: FooterProps) {
  const { t } = useTranslation()
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>{t("agendas.footer.resources", { count: resources })}</span>
        <span aria-hidden="true">·</span>
        <span>{t(week ? "agendas.footer.activitiesWeek" : "agendas.footer.activitiesDay", { count: activities })}</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {kinds.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", agendaKindTone[kind].dot)} />
            {t(`agendas.chips.${kind}`)}
          </span>
        ))}
        {updatedMinutes !== null && <span>{updatedMinutes < 1 ? t("agendas.footer.updatedNow") : t("agendas.footer.updatedAgo", { minutes: updatedMinutes })}</span>}
      </div>
    </footer>
  )
}
