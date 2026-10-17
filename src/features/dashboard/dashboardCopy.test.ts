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
})
