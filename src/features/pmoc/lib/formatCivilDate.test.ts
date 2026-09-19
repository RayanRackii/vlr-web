import { describe, expect, it } from "vitest"

import { formatBrazilInstantDate, formatCivilDateOnly } from "@/features/pmoc/lib/formatCivilDate"

describe("formatCivilDateOnly", () => {
  it("formats API civil dates without shifting the calendar day", () => {
    expect(formatCivilDateOnly("2026-10-01", "pt-BR")).toBe("01/10/2026")
    expect(formatCivilDateOnly("2026-09-19", "en")).toBe("09/19/2026")
  })
})

describe("formatBrazilInstantDate", () => {
  it("formats a Brazil instant on the Brazil calendar day", () => {
    expect(
      formatBrazilInstantDate("2026-08-03T18:00:00-03:00", "pt-BR"),
    ).toBe("03/08/2026")
  })
})
