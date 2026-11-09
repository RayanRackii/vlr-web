import { describe, expect, it } from "vitest"

import { safeStaffReturnTo } from "@/features/rentals/components/resourceWizard/staffReturnTo"

describe("safeStaffReturnTo", () => {
  it("keeps a wizard path and its step", () => {
    expect(
      safeStaffReturnTo("/configuracoes/recursos/abc/assistente?passo=rules"),
    ).toBe("/configuracoes/recursos/abc/assistente?passo=rules")
  })

  it("keeps the resource list and the resource editor", () => {
    expect(safeStaffReturnTo("/configuracoes/recursos")).toBe("/configuracoes/recursos")
    expect(safeStaffReturnTo("/configuracoes/recursos/abc")).toBe("/configuracoes/recursos/abc")
  })

  it("rejects paths that leave the resource wizard", () => {
    expect(safeStaffReturnTo("https://evil.example/configuracoes/recursos")).toBeNull()
    expect(safeStaffReturnTo("//evil.example")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/../admin")).toBeNull()
    expect(safeStaffReturnTo("/dashboard")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/menu")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/agenda")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/abc/assistente#hash")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/abc/assistente?passo=rules&next=/admin")).toBeNull()
  })

  it("rejects encoded dots and slashes, including a second layer of encoding", () => {
    expect(safeStaffReturnTo("%252e%252e")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/%252e%252e/admin")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/%252e%252e/assistente")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/%2e%2e/assistente")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/%2fadmin")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/%5cadmin")).toBeNull()
    expect(safeStaffReturnTo("/configuracoes/recursos/%252fadmin/assistente")).toBeNull()
  })
})
