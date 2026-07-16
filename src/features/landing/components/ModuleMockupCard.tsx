import { cn } from "@/lib/utils"

type ModuleMockupCardProps = {
  title: string
  className?: string
  cellCount?: 2 | 4
}

export function ModuleMockupCard({
  title,
  className,
  cellCount = 4,
}: ModuleMockupCardProps) {
  return (
    <div
      className={cn(
        "flex h-48 w-64 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-white/70 shadow-xl backdrop-blur-md dark:bg-black/50",
        className
      )}
      aria-hidden="true"
    >
      <aside className="flex w-14 shrink-0 flex-col gap-2 border-r border-border/40 bg-muted/30 p-2.5">
        <div className="h-2 w-full rounded-full bg-primary/40 blur-[0.5px]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-1.5 rounded-full bg-muted-foreground/25 blur-[0.5px]"
            style={{ width: `${68 - index * 8}%` }}
          />
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <header className="mb-3 border-b border-border/30 pb-2">
          <p className="truncate text-xs font-semibold text-foreground">{title}</p>
          <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-muted-foreground/20" />
        </header>

        <div
          className={cn(
            "grid flex-1 gap-2",
            cellCount === 2 ? "grid-cols-1" : "grid-cols-2"
          )}
        >
          {Array.from({ length: cellCount }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "animate-pulse rounded-lg border border-border/30 bg-muted/40",
                cellCount === 2 ? "min-h-[3.5rem]" : "min-h-[2.5rem]"
              )}
              style={{ animationDelay: `${index * 180}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
