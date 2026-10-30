import { describe, expect, it } from "vitest"

import { moduleGuideConfigs } from "./configs"
import type { GuideStep } from "./types"
import i18n from "@/lib/i18n"

const locales = ["pt-BR", "en", "es"] as const

function hasKey(locale: string, key: string): boolean {
  const value: unknown = i18n.getResource(locale, "common", key)
  return typeof value === "string" && value.length > 0
}

/** Every i18n key a step renders through, so we can assert pt/en/es parity. */
function stepKeys(step: GuideStep): string[] {
  const keys = [step.titleKey, step.lesson.headlineKey, step.lesson.explanationKey, ...step.lesson.whyItMattersKeys]
  if (step.shortKey) keys.push(step.shortKey)
  for (const node of step.lesson.diagram) keys.push(node.titleKey, node.captionKey)
  const demo = step.lesson.demo
  if (demo?.kind === "resourcePreview") keys.push(demo.nameKey, demo.typeKey)
  if (demo?.kind === "connections") for (const item of demo.items) keys.push(item.titleKey, item.captionKey)
  if (demo?.kind === "screenPreview") for (const row of demo.rows) keys.push(row.titleKey, row.captionKey, row.tagKey)
  return keys
}

describe("moduleGuideConfigs", () => {
  const configs = Object.values(moduleGuideConfigs)

  it("has a config for every module", () => {
    expect(configs.length).toBeGreaterThan(0)
  })

  it("has no points or badges on any config", () => {
    for (const config of configs) {
      expect(config).not.toHaveProperty("badges")
      for (const step of config.steps) {
        expect(step).not.toHaveProperty("points")
        expect(step).not.toHaveProperty("badgeId")
      }
    }
  })

  it.each(configs)("has at least one step and unique step ids ($key)", (config) => {
    expect(config.steps.length).toBeGreaterThan(0)
    expect(new Set(config.steps.map((step) => step.id)).size).toBe(config.steps.length)
  })

  it.each(configs)("every step carries a lesson with a diagram and reasons ($key)", (config) => {
    for (const step of config.steps) {
      expect(step.lesson.diagram.length).toBeGreaterThan(0)
      expect(step.lesson.whyItMattersKeys.length).toBeGreaterThan(0)
    }
  })

  it.each(configs.flatMap((config) => config.steps.map((step) => [config.key, step] as const)))(
    "step %s has pt/en/es copy for every rendered key",
    (_key, step) => {
      for (const key of stepKeys(step)) {
        for (const locale of locales) {
          expect(hasKey(locale, key), `${locale}: ${key}`).toBe(true)
        }
      }
    },
  )

  const sharedDemoKeys = [
    "moduleGuide.demo.weekly.title",
    "moduleGuide.demo.weekly.resourceHours",
    "moduleGuide.demo.weekly.customerView",
    "moduleGuide.demo.weekly.morning.label",
    "moduleGuide.demo.weekly.afternoon.label",
    "moduleGuide.demo.weekly.total",
    "moduleGuide.demo.weekly.empty",
    "moduleGuide.demo.freq.title",
    "moduleGuide.demo.freq.options.monthly",
    "moduleGuide.demo.freq.options.quarterly",
    "moduleGuide.demo.freq.options.biannual",
    "moduleGuide.demo.freq.orderTitle",
    "moduleGuide.demo.resource.title",
    "moduleGuide.demo.connections.title",
    "moduleGuide.demo.screen.title",
  ]

  it.each(sharedDemoKeys)("shared demo key %s has pt/en/es copy", (key) => {
    for (const locale of locales) {
      expect(hasKey(locale, key), `${locale}: ${key}`).toBe(true)
    }
  })

  it("weekly days and freq months arrays have the expected length in every locale", () => {
    for (const locale of locales) {
      const days = i18n.getResource(locale, "common", "moduleGuide.demo.weekly.days")
      const months = i18n.getResource(locale, "common", "moduleGuide.demo.freq.months")
      expect(Array.isArray(days) && days.length).toBe(7)
      expect(Array.isArray(months) && months.length).toBe(12)
    }
  })
})
