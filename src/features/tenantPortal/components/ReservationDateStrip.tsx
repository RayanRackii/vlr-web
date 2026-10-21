import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = { dates: readonly string[]; selectedDate: string; locale: string; onSelect: (date: string) => void; onPrevious: () => void; onNext: () => void }

export function ReservationDateStrip({ dates, selectedDate, locale, onSelect, onPrevious, onNext }: Props) {
  const { t } = useTranslation()
  return <nav aria-label={t("tenantPortal.agenda.date")} className="flex items-stretch gap-2 overflow-hidden">
    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={onPrevious} aria-label={t("tenantPortal.agenda.previousDays")}><ChevronLeft /></Button>
    <div className="grid min-w-0 flex-1 grid-cols-7 gap-1" role="list">
      {dates.map((date, index) => {
        const day = new Date(`${date}T00:00:00Z`)
        const label = index === 0 ? t("tenantPortal.agenda.today") : index === 1 ? t("tenantPortal.agenda.tomorrow") : new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(day)
        return <button key={date} type="button" role="listitem" aria-pressed={date === selectedDate} onClick={() => onSelect(date)} className={cn("min-h-11 rounded-md border px-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", date === selectedDate ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}><span className="block truncate">{label}</span><span className="block">{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(day)}</span></button>
      })}
    </div>
    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={onNext} aria-label={t("tenantPortal.agenda.nextDays")}><ChevronRight /></Button>
  </nav>
}
