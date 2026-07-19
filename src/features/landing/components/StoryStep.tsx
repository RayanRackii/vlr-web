import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion"
import {
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"

import { cn } from "@/lib/utils"

/** Fade de saída da seção só depois deste progresso — peça final precisa estar nítida antes. */
export const STORY_EXIT_START = 0.9

export type StoryParagraphWindow = {
  index: number
  start: number
  peakStart: number
  peakEnd: number
  end: number
}

export function getStoryParagraphWindows(
  count: number,
  exitStart: number = STORY_EXIT_START,
): StoryParagraphWindow[] {
  const safeCount = Math.max(count, 1)
  const slice = exitStart / safeCount

  return Array.from({ length: safeCount }, (_, index) => {
    const start = index * slice
    const end = (index + 1) * slice
    const ramp = slice * 0.22

    return {
      index,
      start,
      peakStart: Math.min(start + ramp, end),
      peakEnd: Math.max(end - ramp, start),
      end,
    }
  })
}

export function getStoryParagraphOpacityKeys(
  window: StoryParagraphWindow,
  isLast: boolean,
): { input: number[]; output: number[] } {
  if (isLast) {
    return {
      input: [window.start, window.peakStart, 1],
      output: [0.35, 1, 1],
    }
  }

  return {
    input: [window.start, window.peakStart, window.peakEnd, window.end],
    output: [0.35, 1, 1, 0.35],
  }
}

export type StoryStepRenderApi = {
  progress: MotionValue<number>
  reducedMotion: boolean
  windows: StoryParagraphWindow[]
  sectionRef: RefObject<HTMLElement | null>
}

type StoryStepProps = {
  id?: string
  eyebrow: string
  headline: string
  paragraphs: readonly string[]
  children: (api: StoryStepRenderApi) => ReactNode
  className?: string
  contentClassName?: string
}

export function StoryStep({
  id,
  eyebrow,
  headline,
  paragraphs,
  children,
  className,
  contentClassName,
}: StoryStepProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = Boolean(prefersReducedMotion)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  const windows = useMemo(
    () => getStoryParagraphWindows(paragraphs.length),
    [paragraphs.length],
  )

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn("relative h-[220vh] w-full", className)}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden bg-gradient-to-br from-primary/[0.04] via-background to-background">
        <div
          className={cn(
            "mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12 lg:px-24",
            contentClassName,
          )}
        >
          <div className="relative z-10 max-w-xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="mb-6 text-balance text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
              {headline}
            </h2>
            <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
              {paragraphs.map((text, index) => (
                <StoryParagraph
                  key={`${id ?? "step"}-${index}`}
                  progress={scrollYProgress}
                  window={windows[index]!}
                  isLast={index === paragraphs.length - 1}
                  reducedMotion={reducedMotion}
                >
                  {text}
                </StoryParagraph>
              ))}
            </div>
          </div>

          <div className="relative z-0 flex min-h-0 items-center justify-center lg:justify-end">
            {children({
              progress: scrollYProgress,
              reducedMotion,
              windows,
              sectionRef,
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function StoryParagraph({
  children,
  progress,
  window,
  isLast,
  reducedMotion,
}: {
  children: string
  progress: MotionValue<number>
  window: StoryParagraphWindow
  isLast: boolean
  reducedMotion: boolean
}) {
  const keys = getStoryParagraphOpacityKeys(window, isLast)
  const opacity = useTransform(progress, keys.input, keys.output)

  return (
    <motion.p
      className="text-pretty"
      style={reducedMotion ? { opacity: 1 } : { opacity }}
    >
      {children}
    </motion.p>
  )
}
