import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { formatLocaleCivilDate } from "@/lib/localeFormat"
import { cn } from "@/lib/utils"

export type LocaleDateChangeSource = "input" | "calendar"

type LocaleDateInputProps = {
  id?: string
  value: string
  locale: string
  min?: string
  max?: string
  today?: string
  invalid?: boolean
  describedBy?: string
  onChange: (value: string, source: LocaleDateChangeSource) => void
  onBlur?: () => void
  className?: string
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseIso(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value)
  if (!match) {
    return null
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function toIso(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day))
  const nextYear = utc.getUTCFullYear()
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const nextDay = String(utc.getUTCDate()).padStart(2, "0")
  return `${nextYear}-${nextMonth}-${nextDay}`
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const utc = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1 }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function weekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Monday-first for pt-BR and es. Sunday-first for en. */
function weekStart(locale: string): number {
  return locale.toLowerCase().startsWith("en") ? 0 : 1
}

function monthLabel(year: number, month: number, locale: string): string {
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1)
}

function weekdayLabels(locale: string, start: number): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.UTC(2024, 0, 7 + ((start + index) % 7)))
    return new Intl.DateTimeFormat(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    }).format(day)
  })
}

function isOutside(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) {
    return true
  }
  if (max && iso > max) {
    return true
  }
  return false
}

/**
 * Keeps an ISO `YYYY-MM-DD` value for the field and shows that day in the
 * active locale. The popup calendar follows `locale` (month names) and the
 * app language (Today / Clear), including days outside min/max.
 */
export function LocaleDateInput({
  id,
  value,
  locale,
  min,
  max,
  today,
  invalid,
  describedBy,
  onChange,
  onBlur,
  className,
}: LocaleDateInputProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()
  const [open, setOpen] = useState(false)
  const parsed = parseIso(value)
  const [cursor, setCursor] = useState(() =>
    parsed ?? { year: 2026, month: 1 },
  )
  const formatted = formatLocaleCivilDate(value, locale)

  useEffect(() => {
    if (!open) {
      return
    }
    const next = parseIso(value)
    if (next) {
      setCursor({ year: next.year, month: next.month })
    }
  }, [open, value])

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function choose(next: string) {
    onChange(next, "calendar")
    setOpen(false)
  }

  const start = weekStart(locale)
  const lead = (weekday(cursor.year, cursor.month, 1) - start + 7) % 7
  const count = daysInMonth(cursor.year, cursor.month)
  const label = monthLabel(cursor.year, cursor.month, locale)
  const headers = weekdayLabels(locale, start)

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        data-slot="date-field"
        data-invalid={invalid || undefined}
        className="relative min-h-10 rounded-lg"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex min-h-10 items-center rounded-lg border border-input px-2.5 text-sm text-foreground",
            invalid && "border-destructive",
          )}
        >
          {formatted}
        </span>
        <Input
          id={id}
          type="date"
          lang={locale}
          min={min}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-controls={dialogId}
          onMouseDown={(event) => {
            event.preventDefault()
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter") {
              event.preventDefault()
              setOpen(true)
            }
          }}
          onBlur={onBlur}
          onChange={(event) => {
            // `max` stays off this control. Chrome drops a typed day past
            // max and the field snaps back with an empty value.
            onChange(event.target.value, "input")
            setOpen(false)
          }}
          className="absolute inset-0 h-10 cursor-pointer opacity-0"
        />
      </div>
      {open ? (
        <div
          id={dialogId}
          role="dialog"
          lang={locale}
          aria-label={label}
          className="absolute z-50 mt-1 w-full min-w-80 rounded-lg border border-border bg-popover p-2.5 text-popover-foreground shadow-md"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted"
              aria-label={t("common.datePicker.previousMonth")}
              onClick={() => {
                setCursor((current) => shiftMonth(current.year, current.month, -1))
              }}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-medium">{label}</p>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted"
              aria-label={t("common.datePicker.nextMonth")}
              onClick={() => {
                setCursor((current) => shiftMonth(current.year, current.month, 1))
              }}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground">
            {headers.map((header, index) => (
              <span key={`${header}-${index}`} aria-hidden>
                {header}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {Array.from({ length: lead }, (_, index) => (
              <span key={`pad-${index}`} />
            ))}
            {Array.from({ length: count }, (_, index) => {
              const day = index + 1
              const iso = toIso(cursor.year, cursor.month, day)
              const outside = isOutside(iso, min, max)
              const selected = iso === value
              return (
                <button
                  key={iso}
                  type="button"
                  aria-label={formatLocaleCivilDate(iso, locale)}
                  aria-disabled={outside || undefined}
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-lg text-sm",
                    selected && "bg-primary text-primary-foreground",
                    !selected && !outside && "hover:bg-muted",
                    outside && "cursor-not-allowed text-muted-foreground/50",
                  )}
                  onClick={() => {
                    choose(iso)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm hover:bg-muted"
              onClick={() => {
                choose("")
              }}
            >
              {t("common.datePicker.clear")}
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm hover:bg-muted"
              onClick={() => {
                if (today) {
                  choose(today)
                }
              }}
            >
              {t("common.datePicker.today")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
