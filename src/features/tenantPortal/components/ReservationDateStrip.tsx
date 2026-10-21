import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"
import { cn } from "@/lib/utils"

type Props = { dates: readonly string[]; selectedDate: string; locale: string; onSelect: (date: string) => void; onPrevious: () => void; onNext: () => void }

export function ReservationDateStrip({ dates, selectedDate, locale, onSelect, onPrevious, onNext }: Props) {
  const { t } = useTranslation()
  const today = brazilTodayIsoDate()
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowDate = tomorrow.toISOString().slice(0, 10)

  return <nav aria-label={t("tenantPortal.agenda.date")} className="flex items-stretch gap-2">
    <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" onClick={onPrevious} aria-label={t("tenantPortal.agenda.previousDays")}><ChevronLeft /></Button>
    <div className="min-w-0 flex-1 overflow-x-auto">
      <div className="flex min-w-max gap-1">
      {dates.map((date) => {
        const day = new Date(`${date}T00:00:00Z`)
        const label = date === today ? t("tenantPortal.agenda.today") : date === tomorrowDate ? t("tenantPortal.agenda.tomorrow") : new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(day)
        return <button key={date} type="button" aria-pressed={date === selectedDate} onClick={() => onSelect(date)} className={cn("min-h-11 min-w-20 rounded-md border px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", date === selectedDate ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}><span className="block truncate">{label}</span><span className="block">{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(day)}</span></button>
      })}
      </div>
    </div>
    <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" onClick={onNext} aria-label={t("tenantPortal.agenda.nextDays")}><ChevronRight /></Button>
  </nav>
}
