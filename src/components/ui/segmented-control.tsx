import { useId, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

type SegmentedControlProps<T extends string> = {
  label: string
  value: T
  options: readonly SegmentedControlOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

/**
 * Radio-group style buttons for 2-4 mutually exclusive options (e.g. Active | Inactive).
 * Replaces native <select> dropdowns for small option sets (Rolvix "no dropdown arrows" rule).
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: SegmentedControlProps<T>) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-lg border border-input bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            id={`${id}-${index}`}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              let next: number
              if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length
              else if (event.key === "Home") next = 0
              else if (event.key === "End") next = options.length - 1
              else return
              event.preventDefault()
              onChange(options[next].value)
              document.getElementById(`${id}-${next}`)?.focus()
            }}
            className={cn(
              "touch-target inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
