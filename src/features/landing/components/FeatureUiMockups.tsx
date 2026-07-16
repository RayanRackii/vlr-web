import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

function MockShell({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

/** Passo 1 — módulos / hub */
export function ModulesHubMockup() {
  const { t } = useTranslation()

  const modules = [
    t("landing.features.mockups.modules.inventory"),
    t("landing.features.mockups.modules.pmoc"),
    t("landing.features.mockups.modules.os"),
    t("landing.features.mockups.modules.rentals"),
  ] as const

  return (
    <MockShell title={t("landing.features.mockups.modules.windowTitle")}>
      <div className="mb-3 space-y-1">
        <div className="h-3 w-2/3 rounded bg-foreground/80" />
        <div className="h-2 w-1/2 rounded bg-muted-foreground/30" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {modules.map((label, index) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border border-border bg-background p-3 shadow-sm",
              index === 0 && "ring-1 ring-foreground/15",
            )}
          >
            <div className="mb-2 size-7 rounded-lg bg-muted" />
            <p className="text-xs font-medium text-foreground">{label}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-foreground/70"
                style={{ width: `${55 + index * 12}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </MockShell>
  )
}

/** Passo 2 — processos unificados */
export function UnifiedProcessesMockup() {
  const { t } = useTranslation()

  const steps = [
    t("landing.features.mockups.processes.stepAsset"),
    t("landing.features.mockups.processes.stepPlan"),
    t("landing.features.mockups.processes.stepOrder"),
  ] as const

  return (
    <MockShell title={t("landing.features.mockups.processes.windowTitle")}>
      <div className="space-y-3">
        {steps.map((label, index) => (
          <div key={label} className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground shadow-sm">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm">
              <p className="truncate text-xs font-medium text-foreground">
                {label}
              </p>
              <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-muted" />
            </div>
            {index < steps.length - 1 ? (
              <div className="absolute" aria-hidden />
            ) : null}
          </div>
        ))}
        <div className="mt-1 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("landing.features.mockups.processes.footer")}
          </p>
        </div>
      </div>
    </MockShell>
  )
}

/** Passo 3 — gestão inteligente */
export function SmartOpsMockup() {
  const { t } = useTranslation()

  return (
    <MockShell title={t("landing.features.mockups.smart.windowTitle")}>
      <div className="mb-3 flex items-end gap-1.5">
        {[40, 65, 45, 80, 55, 90, 70].map((height, index) => (
          <div
            key={index}
            className="flex-1 rounded-t-md bg-foreground/70"
            style={{ height: `${height * 0.7}px` }}
          />
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
          <div className="space-y-1">
            <div className="h-2 w-28 rounded bg-foreground/70" />
            <div className="h-1.5 w-20 rounded bg-muted-foreground/30" />
          </div>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            {t("landing.features.mockups.smart.badgeAuto")}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
          <div className="space-y-1">
            <div className="h-2 w-24 rounded bg-foreground/70" />
            <div className="h-1.5 w-16 rounded bg-muted-foreground/30" />
          </div>
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            {t("landing.features.mockups.smart.badgeAlert")}
          </span>
        </div>
      </div>
    </MockShell>
  )
}

/** Passo 4 — escala / tenants */
export function ScaleReadyMockup() {
  const { t } = useTranslation()

  const tenants = [
    t("landing.features.mockups.scale.tenantA"),
    t("landing.features.mockups.scale.tenantB"),
    t("landing.features.mockups.scale.tenantC"),
  ] as const

  return (
    <MockShell title={t("landing.features.mockups.scale.windowTitle")}>
      <div className="mb-3 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-2.5 w-32 rounded bg-foreground/80" />
          <div className="h-1.5 w-20 rounded bg-muted-foreground/30" />
        </div>
        <div className="rounded-lg bg-foreground px-2.5 py-1 text-[10px] font-medium text-background">
          {t("landing.features.mockups.scale.cta")}
        </div>
      </div>
      <div className="space-y-2">
        {tenants.map((name, index) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm"
          >
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg text-[10px] font-semibold text-background",
                index === 0 && "bg-zinc-800 dark:bg-zinc-200 dark:text-zinc-900",
                index === 1 && "bg-zinc-600 dark:bg-zinc-400 dark:text-zinc-900",
                index === 2 && "bg-zinc-400 dark:bg-zinc-500",
              )}
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {name}
              </p>
              <div className="mt-1 h-1.5 w-2/3 rounded-full bg-muted" />
            </div>
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          </div>
        ))}
      </div>
    </MockShell>
  )
}
