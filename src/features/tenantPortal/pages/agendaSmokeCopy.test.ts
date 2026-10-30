import { describe, expect, it } from "vitest"

import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import pt from "@/locales/pt-BR/common.json"

describe("agenda smoke copy", () => {
  it.each([pt, en, es])("has the new feedback keys and a locale-formatted multiplier", (locale) => {
    const agenda = (locale as unknown as { tenantPortal: { agenda: Record<string, string> } }).tenantPortal.agenda
    expect(agenda.chooseTimeFirst).toBeTruthy()
    expect(agenda.quantityMaxReached).toContain("{{count}}")
    expect(agenda.quoteUnitMultiplier).toBe("× {{formatted}}")
    expect(agenda.yourReservationUnitsReason).not.toMatch(/Para mais unidades|For more units|Para más unidades/)
  })
})
