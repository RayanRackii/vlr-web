import {
  AlertCircle,
  Calendar,
  ClipboardCheck,
  DollarSign,
  Package,
  Snowflake,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

export type ModuleMockupType =
  | "financeiro"
  | "pmoc"
  | "os"
  | "rh"
  | "aluguel"
  | "inventario"

type ModuleMockupCardProps = {
  type: ModuleMockupType
  title: string
  className?: string
}

export function ModuleMockupCard({
  type,
  title,
  className,
}: ModuleMockupCardProps) {
  const Icon = MODULE_ICONS[type]

  return (
    <div
      className={cn(
        "h-48 w-72 shrink-0 overflow-hidden rounded-xl border border-white/40 bg-white/80 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-black/50",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex h-8 items-center border-b border-border/40 bg-white/35 px-3 dark:bg-white/5">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-red-400" />
          <span className="size-2 rounded-full bg-amber-400" />
          <span className="size-2 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto flex -translate-x-4 items-center gap-1.5 text-[10px] font-semibold text-foreground/80">
          <Icon className="size-3" />
          <span>{title}</span>
        </div>
      </div>

      <div className="h-40 p-3">
        <ModuleContent type={type} />
      </div>
    </div>
  )
}

const MODULE_ICONS: Record<ModuleMockupType, LucideIcon> = {
  financeiro: DollarSign,
  pmoc: ClipboardCheck,
  os: Wrench,
  rh: Users,
  aluguel: Calendar,
  inventario: Package,
}

function ModuleContent({ type }: { type: ModuleMockupType }) {
  switch (type) {
    case "financeiro":
      return <FinanceContent />
    case "pmoc":
      return <PmocContent />
    case "os":
      return <WorkOrderContent />
    case "rh":
      return <HrContent />
    case "aluguel":
      return <RentalContent />
    case "inventario":
      return <InventoryContent />
  }
}

function FinanceContent() {
  const barHeights = ["h-8 bg-emerald-400", "h-12 bg-emerald-500", "h-6 bg-red-400", "h-10 bg-emerald-400", "h-7 bg-red-300"]

  return (
    <div className="grid h-full grid-cols-[1fr_1.15fr] gap-3">
      <div className="flex items-end justify-around rounded-lg border border-border/40 bg-muted/25 px-2 pb-2 pt-4">
        {barHeights.map((classes, index) => (
          <span key={index} className={cn("w-3 rounded-t-sm", classes)} />
        ))}
      </div>
      <div className="space-y-2 pt-1">
        {["bg-emerald-500", "bg-red-400", "bg-emerald-500"].map((color, index) => (
          <div key={index} className="flex items-center gap-2 rounded-md border border-border/30 bg-background/55 p-2">
            <span className={cn("size-2 rounded-full", color)} />
            <div className="flex-1 space-y-1">
              <span className="block h-1.5 w-full rounded bg-foreground/25" />
              <span className="block h-1 w-2/3 rounded bg-muted-foreground/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PmocContent() {
  const { t } = useTranslation()

  return (
    <div className="grid h-full grid-cols-[0.85fr_1.15fr] gap-3">
      <div className="flex flex-col items-center justify-center rounded-lg bg-emerald-500/10">
        <div className="grid size-14 place-items-center rounded-full border-[5px] border-emerald-500 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          100%
        </div>
        <span className="mt-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[7px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
          {t("landing.hero.mockups.compliant")}
        </span>
      </div>
      <div className="space-y-2 pt-2">
        {[78, 92].map((progress) => (
          <div key={progress} className="rounded-md border border-border/35 bg-background/55 p-2">
            <div className="mb-2 flex items-center gap-1.5">
              <Snowflake className="size-3 text-sky-500" />
              <span className="h-1.5 w-16 rounded bg-foreground/25" />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkOrderContent() {
  const { t } = useTranslation()
  const columns = [
    { label: t("landing.hero.mockups.todo"), cards: 2, color: "bg-slate-400" },
    { label: t("landing.hero.mockups.doing"), cards: 2, color: "bg-amber-400" },
    { label: t("landing.hero.mockups.done"), cards: 3, color: "bg-emerald-500" },
  ]

  return (
    <div className="grid h-full grid-cols-3 gap-2">
      {columns.map((column) => (
        <div key={column.label} className="rounded-md bg-muted/35 p-1.5">
          <div className="mb-2 flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", column.color)} />
            <span className="text-[7px] font-semibold text-muted-foreground">{column.label}</span>
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: column.cards }).map((_, index) => (
              <div key={index} className="h-7 rounded border border-border/30 bg-background/80 p-1.5 shadow-sm">
                <span className="block h-1 w-full rounded bg-foreground/20" />
                <span className="mt-1 block h-1 w-1/2 rounded bg-muted-foreground/15" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function HrContent() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col">
      <div className="grid flex-1 grid-cols-3 gap-2">
        {["bg-violet-300", "bg-sky-300", "bg-amber-300"].map((color, index) => (
          <div key={index} className="flex flex-col items-center rounded-lg border border-border/30 bg-background/50 p-2">
            <span className={cn("size-8 rounded-full", color)} />
            <span className="mt-2 h-1.5 w-10 rounded bg-foreground/25" />
            <span className="mt-1 h-1 w-7 rounded bg-muted-foreground/15" />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-emerald-500/15 py-1.5 text-[8px] font-semibold text-emerald-700 dark:text-emerald-300">
        <ClipboardCheck className="size-3" />
        {t("landing.hero.mockups.payrollProcessed")}
      </div>
    </div>
  )
}

function RentalContent() {
  const highlightedDays: Record<number, string> = {
    4: "bg-sky-500 text-white",
    5: "bg-sky-500 text-white",
    11: "bg-orange-400 text-white",
    18: "bg-sky-500 text-white",
    19: "bg-orange-400 text-white",
    25: "bg-sky-500 text-white",
  }

  return (
    <div className="h-full rounded-lg border border-border/35 bg-background/45 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="h-1.5 w-14 rounded bg-foreground/30" />
        <span className="h-1.5 w-6 rounded bg-muted-foreground/20" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "grid aspect-square place-items-center rounded-sm bg-muted/50 text-[6px] text-muted-foreground",
              highlightedDays[index]
            )}
          >
            {(index % 31) + 1}
          </span>
        ))}
      </div>
    </div>
  )
}

function InventoryContent() {
  const { t } = useTranslation()

  return (
    <div className="h-full overflow-hidden rounded-lg border border-border/35 bg-background/45">
      <div className="grid grid-cols-[1fr_0.7fr_0.8fr] gap-2 border-b border-border/40 bg-muted/40 px-2 py-1.5">
        {[12, 8, 10].map((width) => (
          <span key={width} className="h-1 rounded bg-muted-foreground/25" style={{ width: `${width * 4}px` }} />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid h-7 grid-cols-[1fr_0.7fr_0.8fr] items-center gap-2 border-b border-border/25 px-2 last:border-0">
          <div className="flex items-center gap-1.5">
            <Package className="size-2.5 text-muted-foreground" />
            <span className="h-1.5 w-12 rounded bg-foreground/20" />
          </div>
          <span className="h-1.5 w-7 rounded bg-muted-foreground/15" />
          {index === 0 ? (
            <span className="flex items-center gap-1 rounded bg-red-500/15 px-1 py-0.5 text-[6px] font-semibold text-red-600 dark:text-red-300">
              <AlertCircle className="size-2" />
              {t("landing.hero.mockups.lowStock")}
            </span>
          ) : (
            <span className="h-1.5 w-9 rounded bg-emerald-500/35" />
          )}
        </div>
      ))}
    </div>
  )
}
