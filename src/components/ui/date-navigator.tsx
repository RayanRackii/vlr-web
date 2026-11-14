import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"

export type DateNavigatorProps<V extends string> = {
  /** Civil date, yyyy-MM-dd. */
  date: string
  onDateChange: (date: string) => void
  view: V
  views: readonly { value: V; label: string }[]
  onViewChange: (view: V) => void
  /** Moves the date one unit of the current view. The caller owns the calendar maths. */
  step: (date: string, view: V, direction: -1 | 1) => string
  /** Civil date of today in the tenant time zone. */
  today: string
  /** Formatted date or range, provided by the caller. */
  label: string
  labels: {
    /** Plain string, per-view record, or a function of the view. */
    previous: ViewLabel<V>
    next: ViewLabel<V>
    today: string
    view: string
    /** Accessible name of the button that opens the date picker. */
    pickDate: string
  }
}

type ViewLabel<V extends string> = string | Record<V, string> | ((view: V) => string)

function resolveLabel<V extends string>(label: ViewLabel<V>, view: V): string {
  if (typeof label === "string") return label
  return typeof label === "function" ? label(view) : label[view]
}

/** View switch, previous/next, current label and "today". Knows nothing about what is being navigated. */
export function DateNavigator<V extends string>({
  date,
  onDateChange,
  view,
  views,
  onViewChange,
  step,
  today,
  label,
  labels,
}: DateNavigatorProps<V>) {
  const pickerRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    const input = pickerRef.current
    if (!input) return
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker()
        return
      }
    } catch {
      // showPicker can throw (no user activation, unsupported); fall back below.
    }
    input.focus()
    input.click()
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
      <SegmentedControl label={labels.view} value={view} options={views} onChange={onViewChange} className="max-md:w-full" />
      <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11"
          aria-label={resolveLabel(labels.previous, view)}
          onClick={() => onDateChange(step(date, view, -1))}
        >
          <ChevronLeft className={ICON_SIZE.md} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </Button>
        <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
          <button
            type="button"
            aria-label={labels.pickDate}
            onClick={openPicker}
            className="touch-target min-h-11 w-full min-w-0 cursor-pointer rounded-lg px-2 text-center text-sm font-semibold tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-live="polite" className="first-letter:uppercase">
              {label}
            </span>
          </button>
          <input
            ref={pickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            value={date}
            onChange={(event) => {
              if (event.target.value) onDateChange(event.target.value)
            }}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11"
          aria-label={resolveLabel(labels.next, view)}
          onClick={() => onDateChange(step(date, view, 1))}
        >
          <ChevronRight className={ICON_SIZE.md} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </Button>
      </div>
      <Button type="button" variant="outline" className="touch-target min-h-11" onClick={() => onDateChange(today)}>
        {labels.today}
      </Button>
    </div>
  )
}
