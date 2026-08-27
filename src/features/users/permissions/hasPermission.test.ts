import { describe, expect, it } from "vitest"

import {
  canSubmitRoleIds,
  formatAssignedRoles,
  formatMemberAccessLabel,
  hasPermission,
  toggleUniqueId,
} from "@/features/users/permissions/hasPermission"

describe("hasPermission", () => {
  it("returns true only when the key is present (union from /me)", () => {
    const fromMe = [
      "core.dashboard.read",
      "os.work_orders.read",
      "os.work_orders.execute",
    ]

    expect(hasPermission(fromMe, "os.work_orders.execute")).toBe(true)
    expect(hasPermission(fromMe, "os.work_orders.create")).toBe(false)
    expect(hasPermission([], "core.dashboard.read")).toBe(false)
  })
})

describe("role assignment ids", () => {
  it("toggles unique role ids and requires at least one to submit", () => {
    const first = toggleUniqueId([], "role-a")
    const both = toggleUniqueId(first, "role-b")
    const one = toggleUniqueId(both, "role-a")

    expect(first).toEqual(["role-a"])
    expect(both).toEqual(["role-a", "role-b"])
    expect(one).toEqual(["role-b"])
    expect(canSubmitRoleIds(both)).toBe(true)
    expect(canSubmitRoleIds([])).toBe(false)
  })

  it("formats a member with multiple funções", () => {
    expect(
      formatMemberAccessLabel("João", [
        { name: "Função A" },
        { name: "Função B" },
      ]),
    ).toBe("João — Função A · Função B")
    expect(formatAssignedRoles([])).toBe("")
  })
})
