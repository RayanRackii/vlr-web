import { useTranslation } from "react-i18next"
import { formatZonedTime } from "@/features/catalog/components/agenda/agendaLayout"
import { hoursViolationMessage } from "../model/planningErrors"
import type { PlanningConflict } from "../schemas/planningSchemas"

type Props = {
  conflicts: readonly PlanningConflict[]
  timeZone: string
  className?: string
}

function range(conflict: PlanningConflict, locale: string, zone: string) {
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: zone }).format(new Date(conflict.start))
  return `${day} ${formatZonedTime(conflict.start, locale, zone)} – ${formatZonedTime(conflict.end, locale, zone)}`
}

/** What already occupies the asset, as the API reports it. The label is withheld without read access, so it may be empty. */
export function PlanningConflictList({ conflicts, timeZone, className }: Props) {
  const { t, i18n } = useTranslation()
  if (conflicts.length === 0) return null
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (
    <div className={className} data-testid="planning-conflicts">
      <p className="text-sm font-medium text-destructive">{t("planning.conflicts.title", { count: conflicts.length })}</p>
      <ul className="mt-1.5 space-y-1.5 text-sm">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.allocationId ?? conflict.source}-${conflict.start}-${index}`} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <span className="font-medium">{conflict.label || t("planning.conflicts.noLabel")}</span>
            <span className="text-muted-foreground"> · {t(`planning.conflicts.source.${conflict.source === "reservation" ? "reservation" : "allocation"}`)}</span>
            <span className="block text-muted-foreground tabular-nums">{range(conflict, locale, timeZone)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlanningHoursNotice({ reason, className }: { reason: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={className} data-testid="planning-hours-violation">
      <span className="font-medium text-destructive">{t("planning.hours.title")}</span>{" "}
      <span className="text-muted-foreground">{hoursViolationMessage(reason, t)}</span>
    </p>
  )
}
