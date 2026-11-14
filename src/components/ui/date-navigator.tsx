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
  labels: { previous: string; next: string; today: string; view: string }
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
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
      <SegmentedControl label={labels.view} value={view} options={views} onChange={onViewChange} className="max-md:w-full" />
      <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11"
          aria-label={labels.previous}
          onClick={() => onDateChange(step(date, view, -1))}
        >
          <ChevronLeft className={ICON_SIZE.md} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </Button>
        <span
          aria-live="polite"
          className="min-w-0 flex-1 text-center text-sm font-semibold tabular-nums first-letter:uppercase md:w-72 md:flex-none"
        >
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11"
          aria-label={labels.next}
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
