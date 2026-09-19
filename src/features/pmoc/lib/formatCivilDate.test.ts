import { describe, expect, it } from "vitest"

import { formatCivilDateOnly } from "@/features/pmoc/lib/formatCivilDate"

describe("formatCivilDateOnly", () => {
  it("formats API civil dates without shifting the calendar day", () => {
    expect(formatCivilDateOnly("2026-10-01", "pt-BR")).toBe("01/10/2026")
    expect(formatCivilDateOnly("2026-09-19", "en")).toBe("09/19/2026")
  })
})
