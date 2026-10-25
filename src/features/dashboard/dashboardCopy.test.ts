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
})
