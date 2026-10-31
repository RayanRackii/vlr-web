import { describe, expect, it } from "vitest"

import { formatCatalogDate } from "@/features/catalog/schemas/catalogSchemas"

describe("formatCatalogDate tenant time zone", () => {
  const instant = "2026-10-30T19:59:00Z"

  it("renders the same instant on each tenant clock", () => {
    expect(formatCatalogDate(instant, "pt-BR", "America/Sao_Paulo")).toContain("16:59")
    expect(formatCatalogDate(instant, "pt-BR", "America/Manaus")).toContain("15:59")
  })

  it("falls back to the default tenant zone for an invalid id", () => {
    expect(formatCatalogDate(instant, "pt-BR", "Not/AZone")).toContain("16:59")
  })
})
