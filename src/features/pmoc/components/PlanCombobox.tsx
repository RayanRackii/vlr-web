import { forwardRef, useId, useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type PlanComboboxItem = { value: string; label: string }

/** Searchable single select: a combobox button that opens a filterable listbox. */
export const PlanCombobox = forwardRef<
  HTMLButtonElement,
  {
    id?: string
    items: readonly PlanComboboxItem[]
    value: string
    onChange: (value: string) => void
    onBlur?: () => void
    placeholder: string
    searchLabel: string
    emptyLabel: string
    disabled?: boolean
    invalid?: boolean
    "aria-describedby"?: string
    "aria-label"?: string
  }
>(function PlanCombobox(
  {
    id,
    items,
    value,
    onChange,
    onBlur,
    placeholder,
    searchLabel,
    emptyLabel,
    disabled,
    invalid,
    "aria-describedby": describedBy,
    "aria-label": ariaLabel,
  },
  ref,
) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = items.find((item) => item.value === value)
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle === ""
      ? items
      : items.filter((item) => item.label.toLowerCase().includes(needle))
  }, [items, query])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setQuery("")
        if (!next) onBlur?.()
      }}
    >
      <PopoverTrigger
        render={
          <Button
            ref={ref}
            id={id}
            type="button"
            role="combobox"
            variant="outline"
            disabled={disabled}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            aria-label={ariaLabel}
            className="min-h-11 w-full justify-between font-normal"
          />
        }
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown aria-hidden="true" className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-64">
        <Input
          aria-label={searchLabel}
          placeholder={searchLabel}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
        />
        <div id={listId} role="listbox" aria-label={ariaLabel ?? placeholder} className="max-h-60 overflow-y-auto">
          {visible.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={item.value === value}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded px-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              onClick={() => {
                onChange(item.value)
                setOpen(false)
                setQuery("")
                onBlur?.()
              }}
            >
              <span className="truncate">{item.label}</span>
              {item.value === value ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
            </button>
          ))}
          {visible.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
})
