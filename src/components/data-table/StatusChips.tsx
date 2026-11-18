import { StatusDot } from "@/components/ui/status"
import { STATUS_TONE_STYLES, type StatusTone } from "@/components/ui/status-tones"
import { cn } from "@/lib/utils"

export type StatusChipOption<T extends string> = {
  value: T
  label: string
  tone?: StatusTone
  count?: number
}

export type StatusChipsProps<T extends string> = {
  /** Accessible name of the group. */
  label: string
  /** Label of the always-first "all" chip. */
  allLabel: string
  /** Selected value; null means all. */
  value: T | null
  onChange: (value: T | null) => void
  options: readonly StatusChipOption<T>[]
  allCount?: number
}

function Chip({
  active,
  onClick,
  tone,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  tone?: StatusTone
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "touch-target inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? cn("bg-accent text-accent-foreground", tone ? STATUS_TONE_STYLES[tone].chipActive : "border-foreground/40")
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {tone ? <StatusDot tone={tone} /> : null}
      {label}
      {count !== undefined ? (
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </button>
  )
}

/** Single-select status filter chips ("all" first). Meant for the FilterBar `filters` slot. */
export function StatusChips<T extends string>({ label, allLabel, value, onChange, options, allCount }: StatusChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex w-full min-w-0 flex-wrap gap-1.5">
      <Chip active={value === null} onClick={() => onChange(null)} label={allLabel} count={allCount} />
      {options.map((option) => (
        <Chip
          key={option.value}
          active={value === option.value}
          onClick={() => onChange(option.value)}
          tone={option.tone}
          label={option.label}
          count={option.count}
        />
      ))}
    </div>
  )
}
