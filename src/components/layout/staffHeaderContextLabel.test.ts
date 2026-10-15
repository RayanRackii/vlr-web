import { describe, expect, it } from "vitest"

import { staffHeaderContextLabel } from "@/components/layout/staffHeaderContextLabel"

const fallback = "Área autenticada"

describe("staffHeaderContextLabel", () => {
  it("uses the tenant trade name", () => {
    expect(
      staffHeaderContextLabel(
        { tenantTradeName: " FICC ", tenantLegalName: "FICC LTDA" },
        fallback,
      ),
    ).toBe("FICC")
  })

  it("uses the legal name when the trade name is blank", () => {
    expect(
      staffHeaderContextLabel(
        { tenantTradeName: "  ", tenantLegalName: "FICC LTDA" },
        fallback,
      ),
    ).toBe("FICC LTDA")
  })

  it("keeps the authenticated-area label when the profile has no tenant name", () => {
    expect(staffHeaderContextLabel(null, fallback)).toBe(fallback)
    expect(staffHeaderContextLabel({}, fallback)).toBe(fallback)
  })
})
