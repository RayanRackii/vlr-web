import type { ReactNode } from "react"
import { X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type FilterBarProps = {
  label: string
  search?: { value: string; onChange: (value: string) => void; placeholder: string; label: string }
  filters?: ReactNode
  chips?: { label: string; onRemove: () => void }[]
  /** Rendered at the end of the row. */
  actions?: ReactNode
  className?: string
}

/** Shared filter row: search, filters, removable chips and actions. */
export function FilterBar({ label, search, filters, chips, actions, className }: FilterBarProps) {
  return (
    <section
      aria-label={label}
      className={cn("min-w-0 space-y-3 rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-4", className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        {search ? (
          <Input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.label}
            className="w-full md:w-72"
          />
        ) : null}
        {filters}
        {actions ? <div className="flex flex-wrap items-center gap-2 md:ml-auto">{actions}</div> : null}
      </div>
      {chips && chips.length > 0 ? (
        <ul role="list" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.label}>
              <button
                type="button"
                onClick={chip.onRemove}
                className="touch-target inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 text-xs font-medium text-foreground"
              >
                {chip.label}
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
