import { cn } from "@/lib/utils"
import { tabClass, tabCountClass } from "@/components/ui/tabs-style"

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
      className={tabClass(active)}
    >
      {label}
      {count !== undefined ? (
        <span className={tabCountClass(active)}>{count}</span>
      ) : null}
    </button>
  )
}

/**
 * Single-select underlined tabs with count pills ("all" first). Same contract as StatusChips,
 * for toolbars that sit on the top edge of a card. Scrolls sideways when it does not fit.
 * The tabs overlap the bottom border by 1px (-mb-px), so the vertical axis must be clipped and the
 * scrollbar hidden, or Windows draws a tiny vertical scrollbar at the end of the row.
 */
export function FilterTabs<T extends string>({ label, allLabel, value, onChange, options, allCount, className }: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 items-center gap-5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <Tab active={value === null} onClick={() => onChange(null)} label={allLabel} count={allCount} />
      {options.map((option) => (
        <Tab key={option.value} active={value === option.value} onClick={() => onChange(option.value)} label={option.label} count={option.count} />
      ))}
    </div>
  )
}
