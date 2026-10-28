import { describe, expect, it } from "vitest"

import { moduleGuideConfigs } from "./configs"
import i18n from "@/lib/i18n"

const locales = ["pt-BR", "en", "es"] as const

function hasKey(locale: string, key: string): boolean {
  const value: unknown = i18n.getResource(locale, "common", key)
  return typeof value === "string" && value.length > 0
}

describe("moduleGuideConfigs", () => {
  const configs = Object.values(moduleGuideConfigs)

  it("has a config for every module", () => {
    expect(configs.length).toBeGreaterThan(0)
  })

  it.each(configs)("has at least one step and unique step ids ($key)", (config) => {
    expect(config.steps.length).toBeGreaterThan(0)
    expect(new Set(config.steps.map((step) => step.id)).size).toBe(config.steps.length)
  })

  it.each(configs)("has at least one badge ($key)", (config) => {
    expect(config.badges.length).toBeGreaterThan(0)
  })

  it.each(configs.flatMap((config) => config.steps.map((step) => [config.key, step] as const)))(
    "step %s has pt/en/es copy",
    (_key, step) => {
      for (const locale of locales) {
        expect(hasKey(locale, step.titleKey), `${locale}: ${step.titleKey}`).toBe(true)
        expect(hasKey(locale, step.descriptionKey), `${locale}: ${step.descriptionKey}`).toBe(true)
      }
    },
  )

  const uniqueBadges = [...new Map(configs.flatMap((config) => config.badges).map((badge) => [badge.id, badge])).values()]

  it.each(uniqueBadges)("badge %s has pt/en/es copy", (badge) => {
    for (const locale of locales) {
      expect(hasKey(locale, badge.labelKey), `${locale}: ${badge.labelKey}`).toBe(true)
    }
  })
})
