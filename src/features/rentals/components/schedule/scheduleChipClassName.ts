import { cn } from "@/lib/utils"

export const scheduleChipClassName = (selected: boolean) =>
  cn(
    "min-h-10 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
    selected
      ? "border-primary bg-primary/10 text-primary"
      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
  )
