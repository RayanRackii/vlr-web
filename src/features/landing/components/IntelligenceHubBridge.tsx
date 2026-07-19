import {
  motion,
  useAnimationControls,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion"
import {
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  Mail,
  Package,
  Power,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"

import { BlurFade } from "@/features/landing/components/BlurFade"
import { HubSparkles } from "@/features/landing/components/HubSparkles"
import { ProductionBeamLine } from "@/features/landing/components/ProductionBeamLine"
import { cn } from "@/lib/utils"

type HubNodeId =
  | "spreadsheet"
  | "calendar"
  | "email"
  | "pmoc"
  | "workOrder"
  | "inventory"

type HubNode = {
  id: HubNodeId
  labelKey: string
  Icon: LucideIcon
  variant: "chaos" | "order"
  className: string
  iconClassName?: string
  beamColor?: string
  jitter: {
    duration: number
    x: number
    y: number
  }
}

const CHAOS_NODES = [
  {
    id: "spreadsheet",
    labelKey: "landing.bridge.sources.spreadsheet",
    Icon: FileSpreadsheet,
    variant: "chaos",
    className: "w-[94%] -rotate-[6deg] self-start",
    jitter: { duration: 3.7, x: 2, y: -3 },
  },
  {
    id: "calendar",
    labelKey: "landing.bridge.sources.calendar",
    Icon: CalendarDays,
    variant: "chaos",
    className: "w-[82%] rotate-[3deg] self-end",
    jitter: { duration: 4.4, x: -3, y: 2 },
  },
  {
    id: "email",
    labelKey: "landing.bridge.sources.email",
    Icon: Mail,
    variant: "chaos",
    className: "w-[88%] -rotate-[2deg] self-start ml-4",
    jitter: { duration: 3.2, x: 3, y: -2 },
  },
] as const satisfies readonly HubNode[]

const ORDER_NODES = [
  {
    id: "pmoc",
    labelKey: "landing.hero.products.pmoc",
    Icon: ClipboardCheck,
    variant: "order",
    className:
      "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100",
    iconClassName: "bg-emerald-500 text-white",
    beamColor: "#10b981",
    jitter: { duration: 0, x: 0, y: 0 },
  },
  {
    id: "workOrder",
    labelKey: "landing.hero.products.workOrder",
    Icon: Wrench,
    variant: "order",
    className:
      "border-blue-300/60 bg-blue-50 text-blue-900 dark:bg-blue-950/80 dark:text-blue-100",
    iconClassName: "bg-blue-500 text-white",
    beamColor: "#3b82f6",
    jitter: { duration: 0, x: 0, y: 0 },
  },
  {
    id: "inventory",
    labelKey: "landing.hero.products.inventory",
    Icon: Package,
    variant: "order",
    className:
      "border-violet-300/60 bg-violet-50 text-violet-900 dark:bg-violet-950/80 dark:text-violet-100",
    iconClassName: "bg-violet-500 text-white",
    beamColor: "#8b5cf6",
    jitter: { duration: 0, x: 0, y: 0 },
  },
] as const satisfies readonly HubNode[]

export function IntelligenceHubBridge() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLElement>(null)
  const diagramRef = useRef<HTMLDivElement>(null)
  const spreadsheetRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const pmocRef = useRef<HTMLDivElement>(null)
  const workOrderRef = useRef<HTMLDivElement>(null)
  const inventoryRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isInView = useInView(containerRef, { amount: 0.1 })
  const hubControls = useAnimationControls()
  const pmocControls = useAnimationControls()
  const workOrderControls = useAnimationControls()
  const inventoryControls = useAnimationControls()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  const [hubPowered, setHubPowered] = useState(false)
  const [isPlateau, setIsPlateau] = useState(false)

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Cold intro, then power/plateau through the end of the pin (no trailing dead zone).
    const nextPowered = latest >= 0.38
    const nextIsPlateau = latest >= 0.62

    setHubPowered((current) => (current === nextPowered ? current : nextPowered))
    setIsPlateau((current) =>
      current === nextIsPlateau ? current : nextIsPlateau,
    )
  })

  useEffect(() => {
    const latest = scrollYProgress.get()
    setHubPowered(latest >= 0.38)
    setIsPlateau(latest >= 0.62)
  }, [scrollYProgress])

  // Story fills the whole pin: intro → beams → peak at the end (no exit hold).
  const chaosToHubProgress = useTransform(
    scrollYProgress,
    [0, 0.1, 0.4, 1],
    [0, 0, 1, 1],
  )
  const hubToOrderProgress = useTransform(
    scrollYProgress,
    [0, 0.34, 0.58, 1],
    [0, 0, 1, 1],
  )

  // Chaos: readable at pin start, drifts toward a muted “dead” look.
  const chaosOpacity = useTransform(
    scrollYProgress,
    [0, 0.22, 0.55, 1],
    [0.8, 0.65, 0.55, 0.55],
  )
  const chaosGrayscale = useTransform(
    scrollYProgress,
    [0, 0.22, 0.55, 1],
    [0.45, 0.75, 1, 1],
  )
  const chaosBlur = useTransform(
    scrollYProgress,
    [0, 0.22, 0.55, 1],
    [0, 0.8, 1.5, 1.5],
  )
  const chaosFilter = useTransform(
    [chaosGrayscale, chaosBlur],
    ([grayscale, blur]) =>
      `grayscale(${String(grayscale)}) blur(${String(blur)}px)`,
  )

  // Order modules stay ghosted until beams leave the hub.
  const orderOpacity = [
    useTransform(scrollYProgress, [0, 0.36, 0.55, 1], [0.12, 0.12, 1, 1]),
    useTransform(scrollYProgress, [0, 0.4, 0.59, 1], [0.12, 0.12, 1, 1]),
    useTransform(scrollYProgress, [0, 0.44, 0.63, 1], [0.12, 0.12, 1, 1]),
  ] as const
  const orderFilter = [
    useTransform(
      scrollYProgress,
      [0, 0.36, 0.55, 1],
      [
        "saturate(0.35) blur(7px)",
        "saturate(0.35) blur(7px)",
        "saturate(1) blur(0px)",
        "saturate(1) blur(0px)",
      ],
    ),
    useTransform(
      scrollYProgress,
      [0, 0.4, 0.59, 1],
      [
        "saturate(0.35) blur(7px)",
        "saturate(0.35) blur(7px)",
        "saturate(1) blur(0px)",
        "saturate(1) blur(0px)",
      ],
    ),
    useTransform(
      scrollYProgress,
      [0, 0.44, 0.63, 1],
      [
        "saturate(0.35) blur(7px)",
        "saturate(0.35) blur(7px)",
        "saturate(1) blur(0px)",
        "saturate(1) blur(0px)",
      ],
    ),
  ] as const
  const orderScale = [
    useTransform(scrollYProgress, [0, 0.36, 0.55, 1], [0.94, 0.94, 1, 1]),
    useTransform(scrollYProgress, [0, 0.4, 0.59, 1], [0.94, 0.94, 1, 1]),
    useTransform(scrollYProgress, [0, 0.44, 0.63, 1], [0.94, 0.94, 1, 1]),
  ] as const

  // Hub power-on only after the cold intro — grey LED until then.
  const hubLightColor = useTransform(
    scrollYProgress,
    [0, 0.34, 0.44],
    ["#94a3b8", "#94a3b8", "#10b981"],
  )
  const hubLightShadow = useTransform(
    scrollYProgress,
    [0, 0.34, 0.44],
    [
      "0 0 0 rgba(16,185,129,0)",
      "0 0 0 rgba(16,185,129,0)",
      "0 0 16px rgba(16,185,129,0.9)",
    ],
  )
  const hubGlowOpacity = useTransform(
    scrollYProgress,
    [0, 0.34, 0.44, 1],
    [0, 0, 1, 1],
  )
  const hubGlowScale = useTransform(
    scrollYProgress,
    [0, 0.34, 0.44, 1],
    [0.85, 0.85, 1.15, 1.15],
  )

  const nodeRefs: Record<HubNodeId, RefObject<HTMLDivElement | null>> = {
    spreadsheet: spreadsheetRef,
    calendar: calendarRef,
    email: emailRef,
    pmoc: pmocRef,
    workOrder: workOrderRef,
    inventory: inventoryRef,
  }

  const chaosStyle: MotionStyle = prefersReducedMotion
    ? { filter: "grayscale(1) blur(1px)", opacity: 0.55 }
    : { filter: chaosFilter, opacity: chaosOpacity }
  const isProductionActive =
    isInView && isPlateau && !Boolean(prefersReducedMotion)

  const pulseHub = useCallback(() => {
    void hubControls.start({
      scale: [1, 1.06, 1],
      boxShadow: [
        "0 0 34px rgba(16,185,129,0.22)",
        "0 0 82px rgba(16,185,129,0.72)",
        "0 0 34px rgba(16,185,129,0.22)",
      ],
      transition: { duration: 0.38, ease: "easeOut" },
    })
  }, [hubControls])

  const pulsePmoc = useCallback(() => {
    void pmocControls.start({
      boxShadow: [
        "0 10px 20px rgba(16,185,129,0.08)",
        "0 0 34px rgba(16,185,129,0.55)",
        "0 10px 20px rgba(16,185,129,0.08)",
      ],
      transition: { duration: 0.48, ease: "easeOut" },
    })
  }, [pmocControls])

  const pulseWorkOrder = useCallback(() => {
    void workOrderControls.start({
      boxShadow: [
        "0 10px 20px rgba(59,130,246,0.08)",
        "0 0 34px rgba(59,130,246,0.55)",
        "0 10px 20px rgba(59,130,246,0.08)",
      ],
      transition: { duration: 0.48, ease: "easeOut" },
    })
  }, [workOrderControls])

  const pulseInventory = useCallback(() => {
    void inventoryControls.start({
      boxShadow: [
        "0 10px 20px rgba(139,92,246,0.08)",
        "0 0 34px rgba(139,92,246,0.55)",
        "0 10px 20px rgba(139,92,246,0.08)",
      ],
      transition: { duration: 0.48, ease: "easeOut" },
    })
  }, [inventoryControls])

  const moduleControls = [
    pmocControls,
    workOrderControls,
    inventoryControls,
  ] as const
  const deliveryCallbacks = [
    pulsePmoc,
    pulseWorkOrder,
    pulseInventory,
  ] as const

  return (
    <section
      ref={containerRef}
      aria-labelledby="landing-bridge-title"
      className="relative h-[150vh] w-full"
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)]">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10 md:px-12 lg:px-24">
          <BlurFade className="mx-auto max-w-4xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-primary md:text-sm">
              {t("landing.bridge.eyebrow")}
            </p>
            <h2
              id="landing-bridge-title"
              className="text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl"
            >
              {t("landing.bridge.title")}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t("landing.bridge.description")}
            </p>
          </BlurFade>

          <div
            ref={diagramRef}
            className="relative isolate mx-auto mt-8 w-full max-w-6xl md:min-h-[420px]"
          >
            <div className="pointer-events-none absolute inset-0 z-0 overflow-visible">
              {CHAOS_NODES.map((sourceNode, index) => {
                const destinationNode = ORDER_NODES[index]

                return (
                  <ProductionBeamLine
                    key={`${sourceNode.id}-${destinationNode.id}`}
                    containerRef={diagramRef}
                    sourceRef={nodeRefs[sourceNode.id]}
                    hubRef={hubRef}
                    destinationRef={nodeRefs[destinationNode.id]}
                    incomingProgress={chaosToHubProgress}
                    outgoingProgress={hubToOrderProgress}
                    outputColor={destinationNode.beamColor}
                    startDelay={index * 420}
                    active={isProductionActive}
                    onProcess={pulseHub}
                    onDeliver={deliveryCallbacks[index]}
                  />
                )
              })}
            </div>

            <div className="relative z-10 grid w-full grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] md:gap-10 lg:gap-16">
            <div className="relative flex flex-col gap-6 md:gap-8">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground md:text-left">
                {t("landing.bridge.chaosLabel")}
              </p>
              {CHAOS_NODES.map((node) => {
                const Icon = node.Icon

                return (
                  <motion.div
                    key={node.id}
                    ref={nodeRefs[node.id]}
                    className={cn(
                      "relative rounded-xl border border-border/80 bg-muted p-4 text-foreground/80 shadow-[0_7px_14px_rgba(15,23,42,0.08)]",
                      node.className,
                    )}
                    style={chaosStyle}
                  >
                    <motion.div
                      className="flex items-center gap-3"
                      animate={
                        prefersReducedMotion
                          ? undefined
                          : {
                              x: [0, node.jitter.x, 0],
                              y: [0, node.jitter.y, 0],
                            }
                      }
                      transition={{
                        duration: node.jitter.duration,
                        ease: "easeInOut",
                        repeat: Infinity,
                      }}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background/90">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground/90">
                          {t(node.labelKey)}
                        </p>
                        <span className="mt-1 inline-flex rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                          {t("landing.bridge.uncontrolled")}
                        </span>
                      </div>
                    </motion.div>
                  </motion.div>
                )
              })}
            </div>

            <div className="relative flex flex-col items-center justify-center py-4">
              <HubGlow
                opacity={hubGlowOpacity}
                scale={hubGlowScale}
                reducedMotion={Boolean(prefersReducedMotion)}
              />
              <HubSparkles
                opacity={prefersReducedMotion ? undefined : hubGlowOpacity}
              />
              <motion.div
                className="pointer-events-none absolute size-40 rounded-[2.4rem] border-2 border-emerald-400/70 md:size-44"
                style={{
                  opacity: prefersReducedMotion ? 0.75 : hubGlowOpacity,
                }}
                animate={
                  prefersReducedMotion || !hubPowered
                    ? undefined
                    : { scale: [0.92, 1.12, 0.92] }
                }
                transition={{
                  duration: 2.8,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
                aria-hidden="true"
              />
              <motion.div
                ref={hubRef}
                className="relative grid size-32 place-items-center rounded-[2rem] border-2 border-slate-300 bg-background text-foreground md:size-36"
                animate={prefersReducedMotion ? undefined : hubControls}
                style={
                  prefersReducedMotion
                    ? {
                        borderColor: "#10b981",
                        boxShadow:
                          "0 0 70px color-mix(in oklab, var(--primary) 35%, transparent)",
                      }
                    : { borderColor: hubLightColor }
                }
              >
                <motion.div
                  className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_72%)]"
                  style={{
                    opacity: prefersReducedMotion ? 0.9 : hubGlowOpacity,
                  }}
                />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <motion.span
                    style={{
                      color: prefersReducedMotion ? "#10b981" : hubLightColor,
                    }}
                  >
                    <Power className="size-5" aria-hidden="true" />
                  </motion.span>
                  <span className="text-2xl font-extrabold tracking-tighter">
                    {t("landing.bridge.hubLabel")}
                    <span className="text-primary">.</span>
                  </span>
                </div>
                <motion.span
                  className="absolute right-4 top-4 size-2.5 rounded-full"
                  style={
                    prefersReducedMotion
                      ? {
                          backgroundColor: "#10b981",
                          boxShadow: "0 0 16px rgba(16,185,129,0.9)",
                        }
                      : {
                          backgroundColor: hubLightColor,
                          boxShadow: hubLightShadow,
                        }
                  }
                  aria-hidden="true"
                />
              </motion.div>
            </div>

            <div className="relative grid gap-5">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-primary md:text-left">
                {t("landing.bridge.orderLabel")}
              </p>
              {ORDER_NODES.map((node, index) => {
                const Icon = node.Icon
                const style: MotionStyle = prefersReducedMotion
                  ? { filter: "saturate(1) blur(0px)", opacity: 1, scale: 1 }
                  : {
                      filter: orderFilter[index],
                      opacity: orderOpacity[index],
                      scale: orderScale[index],
                    }

                return (
                  <motion.div
                    key={node.id}
                    ref={nodeRefs[node.id]}
                    animate={
                      prefersReducedMotion ? undefined : moduleControls[index]
                    }
                    className={cn(
                      "flex min-h-20 w-full items-center gap-4 rounded-2xl border p-4 shadow-lg shadow-black/5",
                      node.className,
                    )}
                    style={style}
                  >
                    <span
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl shadow-sm",
                        node.iconClassName,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{t(node.labelKey)}</p>
                      <span className="mt-1 block text-xs font-medium opacity-70">
                        {t("landing.bridge.connected")}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HubGlow({
  opacity,
  scale,
  reducedMotion,
}: {
  opacity: MotionValue<number>
  scale: MotionValue<number>
  reducedMotion: boolean
}) {
  return (
    <motion.div
      className="pointer-events-none absolute size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_45%,transparent)_0%,transparent_70%)] blur-2xl md:size-64"
      style={
        reducedMotion
          ? { opacity: 0.85, scale: 1.1 }
          : { opacity, scale }
      }
      aria-hidden="true"
    />
  )
}
