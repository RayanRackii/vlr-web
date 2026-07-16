import type { MotionValue } from "framer-motion"
import { motion, useTransform } from "framer-motion"
import { useTranslation } from "react-i18next"

type StepOneGraphicProps = {
  localProgress: MotionValue<number>
}

/**
 * Passo 1 — UI se montando em 4 micro-etapas ligadas ao scroll (useTransform).
 * 0–0.25 sidebar · 0.25–0.50 header · 0.50–0.75 gráficos · 0.75–1.0 notificação
 */
export function StepOneGraphic({ localProgress }: StepOneGraphicProps) {
  const { t } = useTranslation()

  const sidebarOpacity = useTransform(localProgress, [0, 0.25], [0, 1])
  const sidebarX = useTransform(localProgress, [0, 0.25], [-16, 0])

  const headerOpacity = useTransform(localProgress, [0.25, 0.5], [0, 1])
  const headerY = useTransform(localProgress, [0.25, 0.5], [20, 0])

  const chartsOpacity = useTransform(localProgress, [0.5, 0.75], [0, 1])
  const chartsY = useTransform(localProgress, [0.5, 0.75], [20, 0])

  const toastOpacity = useTransform(localProgress, [0.75, 1], [0, 1])
  const toastY = useTransform(localProgress, [0.75, 1], [24, 0])
  const toastScale = useTransform(localProgress, [0.75, 1], [0.94, 1])

  const modules = [
    t("landing.features.mockups.modules.inventory"),
    t("landing.features.mockups.modules.pmoc"),
    t("landing.features.mockups.modules.os"),
    t("landing.features.mockups.modules.rentals"),
  ] as const

  const navItems = [
    t("landing.features.mockups.stepOne.navDashboard"),
    t("landing.features.mockups.stepOne.navAssets"),
    t("landing.features.mockups.stepOne.navOrders"),
    t("landing.features.mockups.stepOne.navSettings"),
  ] as const

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex min-h-[320px]">
          {/* 1 — Sidebar (base da UI) */}
          <motion.aside
            className="flex w-[72px] shrink-0 flex-col gap-2 border-r border-border bg-muted/50 p-2.5"
            style={{ opacity: sidebarOpacity, x: sidebarX }}
          >
            <div className="mb-2 size-8 rounded-lg bg-foreground/80" />
            {navItems.map((label, index) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-lg px-1 py-2"
                title={label}
              >
                <div
                  className={
                    index === 0
                      ? "size-7 rounded-md bg-foreground/70"
                      : "size-7 rounded-md bg-muted-foreground/25"
                  }
                />
                <span className="max-w-full truncate text-[8px] text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </motion.aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* 2 — Header */}
            <motion.header
              className="flex items-center justify-between border-b border-border px-4 py-3"
              style={{ opacity: headerOpacity, y: headerY }}
            >
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">
                  {t("landing.features.mockups.modules.windowTitle")}
                </p>
                <div className="h-1.5 w-28 rounded-full bg-muted-foreground/25" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-20 rounded-md bg-muted" />
                <div className="size-7 rounded-full bg-muted-foreground/30" />
              </div>
            </motion.header>

            {/* 3 — Gráficos / cards de módulos */}
            <motion.div
              className="grid flex-1 grid-cols-2 gap-2.5 p-4"
              style={{ opacity: chartsOpacity, y: chartsY }}
            >
              {modules.map((label, index) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-background p-3 shadow-sm"
                >
                  <div className="mb-2 size-7 rounded-lg bg-muted" />
                  <p className="text-xs font-medium text-foreground">{label}</p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-foreground/70"
                      style={{ width: `${50 + index * 14}%` }}
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* 4 — Notificação / pop-up final */}
      <motion.div
        className="absolute right-3 top-14 z-10 w-[200px] rounded-xl border border-border bg-card p-3 shadow-2xl"
        style={{
          opacity: toastOpacity,
          y: toastY,
          scale: toastScale,
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <p className="text-[11px] font-semibold text-foreground">
            {t("landing.features.mockups.stepOne.toastTitle")}
          </p>
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {t("landing.features.mockups.stepOne.toastBody")}
        </p>
      </motion.div>
    </div>
  )
}
