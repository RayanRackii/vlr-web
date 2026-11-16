import { describe, expect, it } from "vitest"

import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import pt from "@/locales/pt-BR/common.json"

describe("dashboard customer portal copy", () => {
  it("does not leave an unresolved subdomain token", () => {
    const descriptions = [
      pt.dashboard.sections.customers.description,
      en.dashboard.sections.customers.description,
      es.dashboard.sections.customers.description,
    ]

    for (const description of descriptions) {
      expect(description).not.toMatch(/\{subdom[ií]nio\}|\{subdomain\}/)
      expect(description.length).toBeGreaterThan(0)
    }
  })

  it("does not leave raw English words inside pt-BR/es rentals KPI subtitles", () => {
    const leakedWords = /\bPending\b|\bconfirmed\b|\bspaces\b|\bgoods\b/

    for (const locale of [pt, es]) {
      expect(locale.dashboard.kpi.reservedRevenue.subtitle).not.toMatch(leakedWords)
      expect(locale.dashboard.kpi.rentableSpaces.subtitle).not.toMatch(leakedWords)
      expect(locale.dashboard.kpi.rentableGoods.subtitle).not.toMatch(leakedWords)
    }
  })

  it("uses plain business wording instead of system wording in every locale", () => {
    const visible = [pt, en, es].flatMap((locale) => [
      locale.dashboard.title, locale.dashboard.description,
      locale.pages.dashboard.title, locale.pages.dashboard.description,
      locale.dashboard.kpi.totalCustomers.subtitle, locale.dashboard.charts.families.description,
    ])
    for (const text of visible) {
      expect(text).not.toMatch(/Centro de Comando|Command Center|tenant|módulos e famílias|módulos y familias|asset families/i)
    }
    expect([pt.dashboard.title, en.dashboard.title, es.dashboard.title]).toEqual(["Início", "Home", "Inicio"])
  })

  it("keeps the first-steps copy free of technical wording", () => {
    for (const locale of [pt, en, es]) {
      expect(locale.assistant.firstSteps.description).not.toMatch(/selo|badge|sello|progres/i)
    }
  })
})
