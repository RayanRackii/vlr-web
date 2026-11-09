import { describe, expect, it } from "vitest"

import { safeStaffReturnTo } from "@/features/rentals/components/resourceWizard/staffReturnTo"

describe("safeStaffReturnTo", () => {
  it("keeps a wizard path and its step", () => {
    expect(
      safeStaffReturnTo("/configuracoes/recursos/abc/assistente?passo=rules"),
    ).toBe("/configuracoes/recursos/abc/assistente?passo=rules")
  })

  it("rejects paths that leave the staff app", () => {
    expect(safeStaffReturnTo("https://evil.example/configuracoes/menu")).toBeNull()
    expect(safeStaffReturnTo("//evil.example")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/../admin")).toBeNull()
    expect(safeStaffReturnTo("/dashboard")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/menu#hash")).toBeNull()
  })
})
