import { cn } from "@/lib/utils"

export type FilterTabOption<T extends string> = {
  value: T
  label: string
  count?: number
}

export type FilterTabsProps<T extends string> = {
  /** Accessible name of the group. */
  label: string
  /** Label of the always-first "all" tab. */
  allLabel: string
  /** Selected value; null means all. */
  value: T | null
  onChange: (value: T | null) => void
  options: readonly FilterTabOption<T>[]
  allCount?: number
  className?: string
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "touch-target inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined ? (
        <span className={cn("rounded-md px-1.5 text-xs font-medium tabular-nums", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{count}</span>
      ) : null}
    </button>
  )
}

/**
 * Single-select underlined tabs with count pills ("all" first). Same contract as StatusChips,
 * for toolbars that sit on the top edge of a card. Scrolls sideways when it does not fit.
 */
export function FilterTabs<T extends string>({ label, allLabel, value, onChange, options, allCount, className }: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 items-center gap-5 overflow-x-auto", className)}>
      <Tab active={value === null} onClick={() => onChange(null)} label={allLabel} count={allCount} />
      {options.map((option) => (
        <Tab key={option.value} active={value === option.value} onClick={() => onChange(option.value)} label={option.label} count={option.count} />
      ))}
    </div>
  )
}
