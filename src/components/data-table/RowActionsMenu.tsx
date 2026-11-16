import { Fragment } from "react"
import { Link } from "react-router-dom"
import { MoreHorizontal, type LucideIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type RowActionItem = {
  key: string
  label: string
  icon: LucideIcon
  /** Renders the item as a router link. */
  href?: string
  onSelect?: () => void
  tone?: "default" | "primary" | "danger"
  disabled?: boolean
  /** Small muted line under the label (e.g. why the item is disabled). */
  hint?: string
  separatorBefore?: boolean
}

export type RowActionsMenuProps = {
  items: readonly RowActionItem[]
  /** Accessible name of the trigger. */
  label: string
  busy?: boolean
}

const TONE_CLASS = {
  default: "",
  primary: "bg-primary/10 text-primary focus:bg-primary/15 focus:text-primary",
  danger: "text-destructive focus:bg-destructive/10 focus:text-destructive",
} as const

/** Shared "⋯" row menu: bordered square trigger, rounded panel, icon + label items. */
export function RowActionsMenu({ items, label, busy }: RowActionsMenuProps) {
  if (items.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-busy={busy}
            className="touch-target inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-primary/10 data-popup-open:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary"
          />
        }
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-xl p-1.5 shadow-lg">
        {items.map((item) => {
          const tone = item.tone ?? "default"
          const Icon = item.icon
          return (
            <Fragment key={item.key}>
              {item.separatorBefore ? <DropdownMenuSeparator className="-mx-1.5 my-1.5" /> : null}
              <DropdownMenuItem
                className={cn(
                  "min-h-10 gap-2.5 rounded-lg px-2.5 py-2",
                  item.hint && "items-start",
                  TONE_CLASS[tone],
                )}
                disabled={item.disabled}
                onClick={item.disabled ? undefined : item.onSelect}
                render={item.href && !item.disabled ? <Link to={item.href} /> : undefined}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-4", item.hint && "mt-0.5", tone === "default" && "text-muted-foreground")}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{item.label}</span>
                  {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
                </span>
              </DropdownMenuItem>
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
