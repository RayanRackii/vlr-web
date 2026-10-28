import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { addCivilDays } from "@/features/rentals/lib/bookingHorizon"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  today: string
  locale: string
  max?: string | null
  disabled?: boolean
  onChange: (date: string) => void
}

/** Only dates are rendered: availability for other days has not been requested. */
export function DateStrip({ value, today, locale, max, disabled, onChange }: Props) {
  const { t } = useTranslation()
  const dates = useMemo(() => {
    const values = Array.from({ length: 7 }, (_, offset) => addCivilDays(today, offset)).filter((date) => !max || date <= max)
    if (value >= today && (!max || value <= max) && !values.includes(value)) values.push(value)
    const full = new Intl.DateTimeFormat(locale, { dateStyle: "full" })
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" })
    const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" })
    const month = new Intl.DateTimeFormat(locale, { month: "short" })
    return values.map((date) => {
      const day = new Date(`${date}T12:00:00`)
      return { date, full: full.format(day), weekday: weekday.format(day), day: dayNumber.format(day), month: month.format(day) }
    })
  }, [today, value, max, locale])
  return (
    <div className="portal-date-strip" role="group" aria-label={t("bookingMap.dateStrip")}>
      {dates.map(({ date, full, weekday, day, month }) => {
        const isToday = date === today
        return (
          <button type="button" key={date} disabled={disabled} aria-pressed={value === date}
            aria-label={`${isToday ? `${t("bookingMap.today")}, ` : ""}${full}`}
            className={cn("portal-date", isToday && "portal-date-today")}
            onClick={() => onChange(date)}>
            <span className="portal-today-label">{isToday ? t("bookingMap.today") : "\u00a0"}</span>
            <span className="portal-weekday">{weekday}</span>
            <strong>{day}</strong>
            <span className="portal-month">{month}</span>
          </button>
        )
      })}
    </div>
  )
}
