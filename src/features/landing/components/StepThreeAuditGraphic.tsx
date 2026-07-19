import type { MotionValue } from "framer-motion"
import { motion, useTransform } from "framer-motion"
import { Camera, FileCheck, PenLine, Download } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  STORY_EXIT_START,
  type StoryParagraphWindow,
} from "@/features/landing/components/StoryStep"

type StepThreeAuditGraphicProps = {
  progress: MotionValue<number>
  windows: StoryParagraphWindow[]
  reducedMotion?: boolean
}

export function StepThreeAuditGraphic({
  progress,
  windows,
  reducedMotion = false,
}: StepThreeAuditGraphicProps) {
  const { t } = useTranslation()
  const pain = windows[0]!
  const mechanism = windows[1]!
  const result = windows[2]!

  const shellOpacity = useTransform(
    progress,
    [pain.start, pain.peakStart],
    [0.4, 1],
  )
  const historyOpacity = useTransform(
    progress,
    [mechanism.start, mechanism.peakStart],
    [0, 1],
  )
  const signatureOpacity = useTransform(
    progress,
    [mechanism.peakStart, mechanism.peakEnd],
    [0, 1],
  )
  const photoOpacity = useTransform(
    progress,
    [mechanism.peakEnd - 0.04, result.start],
    [0, 1],
  )
  const exportOpacity = useTransform(
    progress,
    [result.peakStart, Math.min(result.peakEnd, STORY_EXIT_START - 0.04), 1],
    [0, 1, 1],
  )
  const exportScale = useTransform(
    progress,
    [result.peakStart, Math.min(result.peakEnd, STORY_EXIT_START - 0.04)],
    [0.94, 1],
  )

  return (
    <motion.div
      className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      style={reducedMotion ? { opacity: 1 } : { opacity: shellOpacity }}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCheck className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">
            {t("landing.features.mockups.stepThree.title")}
          </p>
        </div>
        <span className="text-[11px] text-foreground/65">
          {t("landing.features.mockups.stepThree.ref")}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <motion.div
          className="rounded-xl border border-border bg-muted/20 p-3"
          style={reducedMotion ? { opacity: 1 } : { opacity: historyOpacity }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
            {t("landing.features.mockups.stepThree.history")}
          </p>
          <p className="mt-2 text-sm text-foreground">
            {t("landing.features.mockups.stepThree.historyLine")}
          </p>
        </motion.div>

        <motion.div
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3"
          style={
            reducedMotion ? { opacity: 1 } : { opacity: signatureOpacity }
          }
        >
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <PenLine className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("landing.features.mockups.stepThree.signature")}
            </p>
            <p className="text-xs text-foreground/65">
              {t("landing.features.mockups.stepThree.signatureMeta")}
            </p>
          </div>
        </motion.div>

        <motion.div
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3"
          style={reducedMotion ? { opacity: 1 } : { opacity: photoOpacity }}
        >
          <span className="grid size-9 place-items-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Camera className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("landing.features.mockups.stepThree.attachment")}
            </p>
            <p className="text-xs text-foreground/65">
              {t("landing.features.mockups.stepThree.attachmentMeta")}
            </p>
          </div>
        </motion.div>

        <motion.button
          type="button"
          tabIndex={-1}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg"
          style={
            reducedMotion
              ? { opacity: 1 }
              : { opacity: exportOpacity, scale: exportScale }
          }
          aria-hidden="true"
        >
          <Download className="size-4" />
          {t("landing.features.mockups.stepThree.export")}
        </motion.button>
      </div>
    </motion.div>
  )
}
