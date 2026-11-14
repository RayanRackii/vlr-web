import { cn } from "@/lib/utils"

/** Single source of truth for the underlined tab look (FilterTabs and the line Tabs). */
export const tabListClass =
  "flex w-full min-w-0 max-w-full items-center justify-start gap-5 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

export const tabBaseClass =
  "touch-target relative -mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring"

export const tabActiveClass = "border-primary font-medium text-primary"
export const tabInactiveClass = "border-transparent text-muted-foreground hover:text-foreground"

/** Same look driven by Base UI's data-active attribute (role=tab triggers). */
export const tabLineStateClass = "border-transparent text-muted-foreground hover:text-foreground data-active:border-primary data-active:font-medium data-active:text-primary"

export function tabClass(active: boolean, className?: string) {
  return cn(tabBaseClass, active ? tabActiveClass : tabInactiveClass, className)
}

export function tabCountClass(active: boolean) {
  return cn("rounded-md px-1.5 text-xs font-medium tabular-nums", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
}
